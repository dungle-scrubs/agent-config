/**
 * Hooks Extension - Claude Code-style hooks for Pi events
 *
 * Supports three hook types:
 *   - command: Run a shell command
 *   - prompt: Single LLM call for evaluation (not yet implemented)
 *   - agent: Spawn a subagent with tool access
 *
 * Hooks can be sync (blocking, can return decisions) or async (background).
 *
 * Configuration in settings.json:
 * {
 *   "hooks": {
 *     "tool_result": [{
 *       "matcher": "write|edit",
 *       "hooks": [{
 *         "type": "agent",
 *         "agent": "reviewer",
 *         "prompt": "Verify changes: $ARGUMENTS",
 *         "async": false,
 *         "timeout": 60
 *       }]
 *     }]
 *   }
 * }
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

/** Hook execution strategy: shell command, LLM prompt, or agent subprocess. */
type HookType = "command" | "prompt" | "agent";

/** Configuration for a single hook action triggered by an event. */
interface HookHandler {
	type: HookType;
	command?: string; // For type: "command"
	agent?: string; // For type: "agent" - agent name from agents dir
	prompt?: string; // For type: "agent" or "prompt" - use $ARGUMENTS for event data
	model?: string; // Model override
	timeout?: number; // Seconds, default: 60 for agent, 30 for prompt, 600 for command
	async?: boolean; // Run in background (command/agent only)
	statusMessage?: string; // Custom spinner message
}

/** Event matcher with associated hooks — runs hooks when matcher regex matches. */
interface HookMatcher {
	matcher?: string; // Regex pattern, empty = match all
	hooks: HookHandler[];
}

/** Top-level hooks configuration keyed by event name. */
interface HooksConfig {
	[eventName: string]: HookMatcher[];
}

/** Result from executing a hook — may block, allow, or provide additional context. */
interface HookResult {
	ok: boolean;
	reason?: string;
	additionalContext?: string;
	decision?: "block" | "allow";
}

// Events that support blocking via hook decisions
const BLOCKABLE_EVENTS = new Set([
	"tool_call", // Can block before tool executes
	"input", // Can block user input
]);

// Map Pi events to what field the matcher filters on
const MATCHER_FIELDS: Record<string, string> = {
	tool_call: "toolName",
	tool_result: "toolName",
	// Add more as needed
};

/**
 * Loads hooks configuration from project or global settings.
 * @param cwd - Current working directory to search for project config
 * @returns Hooks configuration object
 */
function loadHooksConfig(cwd: string): HooksConfig {
	// Try project-local first, then global
	const locations = [
		path.join(cwd, ".pi", "hooks.json"),
		path.join(cwd, ".pi", "settings.json"),
		path.join(process.env.HOME || "", ".pi", "agent", "hooks.json"),
		path.join(process.env.HOME || "", ".pi", "agent", "settings.json"),
	];

	for (const loc of locations) {
		try {
			if (fs.existsSync(loc)) {
				const content = JSON.parse(fs.readFileSync(loc, "utf-8"));
				if (content.hooks) return content.hooks;
			}
		} catch {
			// Ignore parse errors
		}
	}

	return {};
}

/**
 * Checks if a value matches a regex pattern.
 * @param value - Value to test
 * @param pattern - Regex pattern (empty/undefined matches all)
 * @returns True if value matches pattern
 */
function matchesPattern(value: string | undefined, pattern: string | undefined): boolean {
	if (!pattern || pattern === "" || pattern === "*") return true;
	if (!value) return false;
	try {
		return new RegExp(pattern).test(value);
	} catch {
		return value === pattern;
	}
}

/**
 * Runs a command-type hook as a subprocess.
 * @param handler - Hook handler configuration
 * @param eventData - Event data to pass to the command
 * @param cwd - Working directory for the command
 * @param signal - Optional abort signal
 * @returns Hook result with ok status and optional context
 */
async function runCommandHook(
	handler: HookHandler,
	eventData: Record<string, unknown>,
	cwd: string,
	signal?: AbortSignal
): Promise<HookResult> {
	if (!handler.command) return { ok: true };

	const timeout = (handler.timeout ?? 600) * 1000;

	return new Promise((resolve) => {
		if (!handler.command) {
			resolve({ ok: true });
			return;
		}
		const proc = spawn(handler.command, {
			cwd,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, PI_HOOK_EVENT: JSON.stringify(eventData) },
		});

		let stdout = "";
		let stderr = "";
		let killed = false;

		const timeoutId = setTimeout(() => {
			killed = true;
			proc.kill("SIGTERM");
		}, timeout);

		proc.stdin.write(JSON.stringify(eventData));
		proc.stdin.end();

		proc.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		proc.stderr.on("data", (d) => {
			stderr += d.toString();
		});

		if (signal) {
			signal.addEventListener("abort", () => {
				killed = true;
				proc.kill("SIGTERM");
			});
		}

		proc.on("close", (code) => {
			clearTimeout(timeoutId);

			if (killed) {
				resolve({ ok: false, reason: "Hook timed out or was aborted" });
				return;
			}

			// Exit code 2 = blocking error
			if (code === 2) {
				resolve({ ok: false, reason: stderr || "Blocked by hook", decision: "block" });
				return;
			}

			// Exit code 0 = success, parse JSON output
			if (code === 0 && stdout.trim()) {
				try {
					const result = JSON.parse(stdout.trim());
					resolve({
						ok: result.ok ?? true,
						reason: result.reason,
						additionalContext: result.additionalContext,
						decision: result.decision,
					});
					return;
				} catch {
					// Not JSON, treat as additional context
					resolve({ ok: true, additionalContext: stdout.trim() });
					return;
				}
			}

			resolve({ ok: true });
		});
	});
}

/**
 * Runs an agent-type hook by spawning a pi subprocess.
 * @param handler - Hook handler configuration
 * @param eventData - Event data to include in prompt
 * @param cwd - Working directory for the agent
 * @param agentsDir - Directory containing agent definitions
 * @param signal - Optional abort signal
 * @returns Hook result with ok status and optional context
 */
async function runAgentHook(
	handler: HookHandler,
	eventData: Record<string, unknown>,
	cwd: string,
	agentsDir: string,
	signal?: AbortSignal
): Promise<HookResult> {
	const timeout = (handler.timeout ?? 60) * 1000;

	// Build the prompt
	let prompt = handler.prompt || "Evaluate the following event and return JSON: { ok: true/false, reason: '...' }";
	prompt = prompt.replace(/\$ARGUMENTS/g, JSON.stringify(eventData, null, 2));

	// Build pi args
	const args: string[] = ["--mode", "json", "-p", "--no-session"];

	if (handler.model) {
		args.push("--model", handler.model);
	}

	// If agent is specified, load its config
	if (handler.agent) {
		const agentPath = path.join(agentsDir, `${handler.agent}.md`);
		if (fs.existsSync(agentPath)) {
			args.push("--append-system-prompt", agentPath);
		}
	}

	args.push(prompt);

	return new Promise((resolve) => {
		const proc = spawn("pi", args, {
			cwd,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, PI_IS_HOOK_AGENT: "1" },
		});

		let output = "";
		let killed = false;

		const timeoutId = setTimeout(() => {
			killed = true;
			proc.kill("SIGTERM");
		}, timeout);

		proc.stdout.on("data", (d) => {
			output += d.toString();
		});

		if (signal) {
			signal.addEventListener("abort", () => {
				killed = true;
				proc.kill("SIGTERM");
			});
		}

		proc.on("close", (code) => {
			clearTimeout(timeoutId);

			if (killed) {
				resolve({ ok: false, reason: "Hook agent timed out or was aborted" });
				return;
			}

			// Parse the last assistant message for the decision
			const lines = output.trim().split("\n");
			for (let i = lines.length - 1; i >= 0; i--) {
				try {
					const event = JSON.parse(lines[i]);
					if (event.type === "message_end" && event.message?.role === "assistant") {
						// Look for JSON in the response
						for (const part of event.message.content) {
							if (part.type === "text") {
								// Try to extract JSON from the text
								const jsonMatch = part.text.match(/\{[\s\S]*"ok"\s*:\s*(true|false)[\s\S]*\}/);
								if (jsonMatch) {
									try {
										const result = JSON.parse(jsonMatch[0]);
										resolve({
											ok: result.ok ?? true,
											reason: result.reason,
											additionalContext: result.additionalContext,
										});
										return;
									} catch {
										// Continue looking
									}
								}
							}
						}
					}
				} catch {
					// Not JSON, continue
				}
			}

			// Default to ok if no clear decision
			resolve({ ok: code === 0 });
		});
	});
}

/**
 * Registers Claude Code-style hooks for Pi events.
 * @param pi - Extension API for registering event handlers
 */
export default function (pi: ExtensionAPI) {
	let hooksConfig: HooksConfig = {};
	let agentsDir = "";
	let currentCwd = "";
	let ctx: ExtensionContext | null = null;

	// Pending async hook results to deliver on next turn
	const pendingAsyncResults: Array<{ event: string; result: HookResult }> = [];

	pi.on("session_start", async (_event, context) => {
		ctx = context;
		currentCwd = context.cwd;
		hooksConfig = loadHooksConfig(currentCwd);
		agentsDir = path.join(process.env.HOME || "", ".pi", "agent", "agents");

		// Check for project-local agents dir
		const projectAgentsDir = path.join(currentCwd, ".pi", "agents");
		if (fs.existsSync(projectAgentsDir)) {
			agentsDir = projectAgentsDir;
		}
	});

	// Deliver pending async results at turn start
	pi.on("turn_start", async () => {
		if (pendingAsyncResults.length > 0 && ctx) {
			const results = pendingAsyncResults.splice(0);
			for (const { event, result } of results) {
				if (result.additionalContext || result.reason) {
					pi.sendMessage(
						{
							customType: "hook-result",
							content: result.additionalContext || result.reason || "",
							display: true,
							details: { event, ok: result.ok },
						},
						{ deliverAs: "nextTurn" }
					);
				}
			}
		}
	});

	// Helper to run hooks for an event
	async function runHooks(
		eventName: string,
		eventData: Record<string, unknown>,
		signal?: AbortSignal
	): Promise<{ block: boolean; reason?: string; additionalContext?: string }> {
		const matchers = hooksConfig[eventName];
		if (!matchers || matchers.length === 0) {
			return { block: false };
		}

		const matcherField = MATCHER_FIELDS[eventName];
		const matchValue = matcherField ? (eventData[matcherField] as string) : undefined;

		const canBlock = BLOCKABLE_EVENTS.has(eventName);
		let shouldBlock = false;
		let blockReason: string | undefined;
		let additionalContext: string | undefined;

		for (const matcher of matchers) {
			if (!matchesPattern(matchValue, matcher.matcher)) {
				continue;
			}

			for (const handler of matcher.hooks) {
				// Async hooks run in background, cannot block
				if (handler.async) {
					// Fire and forget
					(async () => {
						let result: HookResult;
						if (handler.type === "command") {
							result = await runCommandHook(handler, eventData, currentCwd);
						} else if (handler.type === "agent") {
							result = await runAgentHook(handler, eventData, currentCwd, agentsDir);
						} else {
							return; // prompt type not yet supported async
						}

						// Queue result for next turn
						if (result.additionalContext || result.reason) {
							pendingAsyncResults.push({ event: eventName, result });
						}
					})();
					continue;
				}

				// Sync hooks - run and potentially block
				let result: HookResult;

				if (handler.type === "command") {
					result = await runCommandHook(handler, eventData, currentCwd, signal);
				} else if (handler.type === "agent") {
					result = await runAgentHook(handler, eventData, currentCwd, agentsDir, signal);
				} else {
					// prompt type - TODO: implement single LLM call
					continue;
				}

				if (result.additionalContext) {
					additionalContext = `${(additionalContext || "") + result.additionalContext}\n`;
				}

				if (!result.ok && canBlock) {
					shouldBlock = true;
					blockReason = result.reason;
					break; // First blocking hook wins
				}
			}

			if (shouldBlock) break;
		}

		return { block: shouldBlock, reason: blockReason, additionalContext: additionalContext?.trim() };
	}

	// Hook into tool_call events
	pi.on("tool_call", async (event, _ctx) => {
		const result = await runHooks("tool_call", {
			toolName: event.toolName,
			toolCallId: event.toolCallId,
			input: event.input,
		});

		if (result.block) {
			return { block: true, reason: result.reason || "Blocked by hook" };
		}
	});

	// Hook into tool_result events
	pi.on("tool_result", async (event) => {
		await runHooks("tool_result", {
			toolName: event.toolName,
			toolCallId: event.toolCallId,
			input: event.input,
			content: event.content,
			isError: event.isError,
		});
		// tool_result cannot block (tool already ran)
	});

	// Hook into agent_end events
	pi.on("agent_end", async (event) => {
		await runHooks("agent_end", {
			messages: event.messages,
		});
	});

	// Hook into input events
	pi.on("input", async (event) => {
		const result = await runHooks("input", {
			text: event.text,
			source: event.source,
		});

		if (result.block) {
			return { action: "handled" as const }; // Block the input
		}
	});
}
