/**
 * Intent Logger - Tracks full tool call sequences per user turn
 *
 * Logs to JSONL for pattern analysis. Each line is one IntentTrace
 * representing everything done to fulfill a single user prompt.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

// === Types ===

export interface IntentTrace {
	id: string;
	timestamp: number;
	userPrompt: string;
	toolCalls: ToolCallRecord[];
	outcome: "success" | "partial" | "failed" | "unknown";

	// Derived metrics (computed at turn end)
	metrics?: IntentMetrics;
}

export interface IntentMetrics {
	totalHops: number;
	discoveryHops: number; // discover_tools + get_app_context
	executionHops: number; // execute_tool
	debugHops: number; // bash, read, etc. used for recovery
	failures: FailureRecord[];
	appsUsed: string[];
	toolsExecuted: string[]; // app/tool combinations
}

export interface ToolCallRecord {
	index: number;
	timestamp: number;
	tool: string;
	input: Record<string, unknown>;
	result: "success" | "error" | "pending";
	durationMs?: number;
	errorMessage?: string;

	// For tool-proxy tools, track the app context
	app?: string;
	linkedDiscoveryIndex?: number; // Which discover_tools led to this execute
}

export interface FailureRecord {
	toolIndex: number;
	tool: string;
	errorType: string;
	errorMessage: string;
}

// === State ===

let currentTrace: IntentTrace | null = null;
let lastDiscoveryIndex: number | null = null;
let toolStartTimes: Map<string, number> = new Map();

const LOG_DIR = path.join(process.env.HOME || "~", ".pi", "logs", "tool-proxy");
const LOG_FILE = path.join(LOG_DIR, "intents.jsonl");

// === Helpers ===

function ensureLogDir(): void {
	if (!fs.existsSync(LOG_DIR)) {
		fs.mkdirSync(LOG_DIR, { recursive: true });
	}
}

function generateId(): string {
	return `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function appendToLog(trace: IntentTrace): void {
	ensureLogDir();
	const line = JSON.stringify(trace) + "\n";
	fs.appendFileSync(LOG_FILE, line);
}

function extractApp(tool: string, input: Record<string, unknown>): string | undefined {
	if (tool === "execute_tool" || tool === "get_app_context") {
		return input.app as string | undefined;
	}
	if (tool === "discover_tools") {
		return undefined; // Discovery doesn't target a specific app
	}
	return undefined;
}

function classifyTool(tool: string): "discovery" | "execution" | "debug" {
	if (tool === "discover_tools" || tool === "get_app_context" || tool === "list_apps") {
		return "discovery";
	}
	if (tool === "execute_tool") {
		return "execution";
	}
	return "debug";
}

function computeMetrics(trace: IntentTrace): IntentMetrics {
	const metrics: IntentMetrics = {
		totalHops: trace.toolCalls.length,
		discoveryHops: 0,
		executionHops: 0,
		debugHops: 0,
		failures: [],
		appsUsed: [],
		toolsExecuted: [],
	};

	const appsSet = new Set<string>();
	const toolsSet = new Set<string>();

	for (const call of trace.toolCalls) {
		const category = classifyTool(call.tool);
		if (category === "discovery") metrics.discoveryHops++;
		else if (category === "execution") metrics.executionHops++;
		else metrics.debugHops++;

		if (call.app) appsSet.add(call.app);

		if (call.tool === "execute_tool" && call.app) {
			const toolName = call.input.tool as string | undefined;
			if (toolName) toolsSet.add(`${call.app}/${toolName}`);
		}

		if (call.result === "error") {
			metrics.failures.push({
				toolIndex: call.index,
				tool: call.tool,
				errorType: categorizeError(call.errorMessage),
				errorMessage: call.errorMessage || "Unknown error",
			});
		}
	}

	metrics.appsUsed = Array.from(appsSet);
	metrics.toolsExecuted = Array.from(toolsSet);

	return metrics;
}

function categorizeError(message?: string): string {
	if (!message) return "unknown";
	const lower = message.toLowerCase();
	if (lower.includes("environment variable") || lower.includes("env var")) return "env_var_missing";
	if (lower.includes("context") && lower.includes("first")) return "context_not_loaded";
	if (lower.includes("not found")) return "not_found";
	if (lower.includes("auth") || lower.includes("unauthorized")) return "auth";
	if (lower.includes("timeout")) return "timeout";
	return "other";
}

function determineOutcome(trace: IntentTrace): IntentTrace["outcome"] {
	if (trace.toolCalls.length === 0) return "unknown";

	const lastCalls = trace.toolCalls.slice(-3);
	const hasRecentSuccess = lastCalls.some((c) => c.result === "success" && c.tool === "execute_tool");
	const hasRecentFailure = lastCalls.some((c) => c.result === "error");

	if (hasRecentSuccess && !hasRecentFailure) return "success";
	if (hasRecentSuccess && hasRecentFailure) return "partial";
	if (trace.toolCalls.every((c) => c.result === "error")) return "failed";

	return "unknown";
}

// === Extension Registration ===

export default function intentLogger(pi: ExtensionAPI): void {
	// Start new trace on turn start
	pi.on("turn_start", async (event, ctx) => {
		// Get the user prompt from the most recent user message
		const entries = ctx.sessionManager.getBranch();
		let userPrompt = "";

		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type === "message" && entry.message.role === "user") {
				const content = entry.message.content;
				if (typeof content === "string") {
					userPrompt = content;
				} else if (Array.isArray(content)) {
					const textPart = content.find((c: { type: string }) => c.type === "text") as
						| { text: string }
						| undefined;
					userPrompt = textPart?.text || "";
				}
				break;
			}
		}

		currentTrace = {
			id: generateId(),
			timestamp: Date.now(),
			userPrompt,
			toolCalls: [],
			outcome: "unknown",
		};
		lastDiscoveryIndex = null;
		toolStartTimes.clear();
	});

	// Record tool calls
	pi.on("tool_call", async (event, _ctx) => {
		if (!currentTrace) return;

		const { toolName, toolCallId, input } = event;
		toolStartTimes.set(toolCallId, Date.now());

		// Track discovery index for linking
		if (toolName === "discover_tools") {
			lastDiscoveryIndex = currentTrace.toolCalls.length;
		}

		const record: ToolCallRecord = {
			index: currentTrace.toolCalls.length,
			timestamp: Date.now(),
			tool: toolName,
			input: input as Record<string, unknown>,
			result: "pending",
			app: extractApp(toolName, input as Record<string, unknown>),
		};

		// Link execute_tool to its discovery
		if (toolName === "execute_tool" && lastDiscoveryIndex !== null) {
			record.linkedDiscoveryIndex = lastDiscoveryIndex;
		}

		currentTrace.toolCalls.push(record);
	});

	// Record tool results
	pi.on("tool_result", async (event, _ctx) => {
		if (!currentTrace) return;

		const { toolCallId, isError } = event;
		const startTime = toolStartTimes.get(toolCallId);

		// Find the matching call record
		// Work backwards since the most recent pending call is likely the match
		for (let i = currentTrace.toolCalls.length - 1; i >= 0; i--) {
			const call = currentTrace.toolCalls[i];
			if (call.result === "pending") {
				call.result = isError ? "error" : "success";
				if (startTime) {
					call.durationMs = Date.now() - startTime;
				}
				if (isError) {
					// Extract error message from content
					const textContent = event.content?.find((c: { type: string }) => c.type === "text") as
						| { text: string }
						| undefined;
					call.errorMessage = textContent?.text?.slice(0, 500); // Truncate long errors
				}
				break;
			}
		}
	});

	// Finalize trace on turn end
	pi.on("turn_end", async (_event, _ctx) => {
		if (!currentTrace) return;
		if (currentTrace.toolCalls.length === 0) {
			// No tool calls this turn, don't log
			currentTrace = null;
			return;
		}

		currentTrace.outcome = determineOutcome(currentTrace);
		currentTrace.metrics = computeMetrics(currentTrace);

		appendToLog(currentTrace);
		currentTrace = null;
	});
}
