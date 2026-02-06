/**
 * Tool Proxy Bridge Extension for Pi
 *
 * Connects to tool-proxy's HTTP MCP server and exposes its tools.
 * Includes status indicator and output summarization.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Type } from "@sinclair/typebox";
import docsGate from "./docs-gate.js";
import intentLogger from "./intent-logger.js";
import patternAnalyzer from "./pattern-analyzer.js";
import toolProxyStatus from "./status.js";
import toolProxySummary from "./summary.js";

// === Static Context ===
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_PATH = path.join(__dirname, "context.md");
let staticContext: string | null = null;

/**
 * Load and cache the static context.md file for system prompt injection.
 * @returns Context markdown content, or empty string if file not found
 */
function getStaticContext(): string {
	if (staticContext === null) {
		try {
			staticContext = fs.readFileSync(CONTEXT_PATH, "utf-8");
		} catch {
			staticContext = "";
		}
	}
	return staticContext;
}

// === Context Gate ===
// Apps that don't require get_app_context (simple/self-documenting)
const CONTEXT_EXEMPT_APPS = new Set(["web-search", "calculator", "docs"]);

/**
 * Checks if get_app_context was called for an app in the current conversation.
 * Scans conversation history for prior get_app_context tool calls.
 * @param app - App name to check
 * @param ctx - Extension context with session manager
 * @returns true if context was already loaded
 */
function hasAppContext(app: string, ctx: ExtensionContext): boolean {
	if (CONTEXT_EXEMPT_APPS.has(app)) return true;

	// Scan assistant messages for get_app_context tool calls with matching app
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message") continue;
		const msg = entry.message;

		if (msg.role === "assistant" && msg.content) {
			for (const part of msg.content) {
				const p = part as { type: string; name?: string; arguments?: Record<string, unknown> };
				if (p.type === "toolCall" && p.name === "get_app_context" && p.arguments?.app === app) {
					return true;
				}
			}
		}
	}

	return false;
}

// === MCP Client ===
let client: Client | null = null;
let connecting: Promise<Client> | null = null;
const baseUrl = process.env.TOOL_PROXY_URL || "http://localhost:3100";

/**
 * Creates a new MCP client connection to tool-proxy.
 * @returns Connected MCP client instance
 */
async function createClient(): Promise<Client> {
	const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
	const c = new Client({ name: "pi-tool-proxy-bridge", version: "1.0.0" });

	transport.onclose = () => {
		client = null;
		connecting = null;
	};
	transport.onerror = () => {
		client = null;
		connecting = null;
	};

	await c.connect(transport);
	return c;
}

/**
 * Gets or creates an MCP client connection with deduplication.
 * @returns MCP client instance (existing or newly created)
 */
async function getClient(): Promise<Client> {
	if (client) return client;
	if (connecting) return connecting;

	connecting = createClient().then((c) => {
		client = c;
		connecting = null;
		return c;
	});

	return connecting;
}

/**
 * Calls a tool via MCP with automatic retry on connection failure.
 * @param name - Tool name to call
 * @param args - Arguments to pass to the tool
 * @returns Tool execution result
 */
async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
	const c = await getClient();
	try {
		return await c.callTool({ name, arguments: args });
	} catch (_err) {
		// Connection may have dropped — retry once
		client = null;
		connecting = null;
		const c2 = await getClient();
		return c2.callTool({ name, arguments: args });
	}
}

/**
 * Closes the MCP client connection if open.
 */
async function closeClient() {
	if (client) {
		await client.close();
		client = null;
		connecting = null;
	}
}

/** Result shape returned by tool-proxy execute_tool calls. */
interface ToolProxyResult {
	content?: Array<{ type: string; text?: string }>;
	isError?: boolean;
	[key: string]: unknown;
}

/**
 * Summarizes docs app results with meaningful context.
 * @returns Summary string, or null to fall through to generic handling
 */
function summarizeDocsResult(text: string, tool: string): string | null {
	try {
		const data = JSON.parse(text);
		switch (tool) {
			case "list_docs": {
				if (!Array.isArray(data) || data.length === 0) return "📚 No docs tracked";
				const fresh = data.filter((d: { status?: string }) => d.status?.startsWith("fresh")).length;
				const stale = data.filter((d: { status?: string }) => d.status?.startsWith("stale")).length;
				const missing = data.filter((d: { status?: string }) => d.status === "missing").length;
				const parts = [`${data.length} docs`];
				if (fresh > 0) parts.push(`${fresh} fresh`);
				if (stale > 0) parts.push(`${stale} stale`);
				if (missing > 0) parts.push(`${missing} missing`);
				return `📚 ${parts.join(", ")}`;
			}
			case "search_docs": {
				if (typeof data === "string") return `🔍 ${data}`;
				if (!Array.isArray(data) || data.length === 0) return "🔍 No matches";
				const totalMatches = data.reduce(
					(sum: number, d: { matches?: unknown[] }) => sum + (d.matches?.length ?? 0),
					0
				);
				const docNames = data.map((d: { doc?: string }) => d.doc).join(", ");
				return `🔍 ${totalMatches} match${totalMatches === 1 ? "" : "es"} across ${data.length} doc${data.length === 1 ? "" : "s"}: ${docNames}`;
			}
			case "get_doc": {
				const name = data.name ?? "unknown";
				const contentLen = data.content?.length ?? 0;
				const sizeKb = (contentLen / 1024).toFixed(1);
				const ageStale = data.age_hours != null && data.age_hours > 24;
				const status = ageStale ? "⚠️ stale" : "fresh";
				return `📄 ${name} (${sizeKb}KB, ${status})`;
			}
			case "add_doc": {
				const added = data.added ?? data.filename ?? "doc";
				const scraped = data.scraped ? "scraped" : "pending";
				return `📥 Added ${added} (${scraped})`;
			}
			case "refresh_docs": {
				const refreshed = data.refreshed?.length ?? 0;
				const failed = data.failed?.length ?? 0;
				const skipped = data.skipped?.length ?? 0;
				const parts: string[] = [];
				if (refreshed > 0) parts.push(`${refreshed} refreshed`);
				if (skipped > 0) parts.push(`${skipped} skipped`);
				if (failed > 0) parts.push(`${failed} failed`);
				return `🔄 ${parts.join(", ") || "nothing to refresh"}`;
			}
			case "remove_doc": {
				const removed = data.removed ?? "doc";
				return `🗑️ Removed ${removed}`;
			}
			default:
				return null;
		}
	} catch {
		return null;
	}
}

/**
 * Summarizes a tool result for concise display.
 * Returns a short summary and the full text for details.
 */
function summarizeResult(text: string, app?: string, tool?: string): { summary: string; full: string } {
	// App-specific summarizers
	if (app === "docs" && tool) {
		const docsSummary = summarizeDocsResult(text, tool);
		if (docsSummary) return { summary: docsSummary, full: text };
	}

	// Try to parse as JSON for smarter summarization
	try {
		const data = JSON.parse(text);

		// Handle common result patterns
		if (data.error) {
			return { summary: `❌ ${data.error}`, full: text };
		}

		// Calculator-style result
		if (data.result !== undefined && (typeof data.result === "number" || typeof data.result === "string")) {
			return { summary: `✓ ${data.result}`, full: text };
		}

		// Firecrawl/scrape results
		if (data.markdown && data.metadata) {
			const title = data.metadata.title || data.metadata.sourceURL || "page";
			const len = data.markdown.length;
			return {
				summary: `✓ Scraped "${title}" (${len} chars)`,
				full: text,
			};
		}

		// Search results
		if (Array.isArray(data.results)) {
			return {
				summary: `✓ ${data.results.length} results`,
				full: text,
			};
		}

		// Array result
		if (Array.isArray(data)) {
			if (data.length === 0) return { summary: "✓ (empty)", full: text };
			return { summary: `✓ ${data.length} items`, full: text };
		}

		// Object with meaningful keys
		const keys = Object.keys(data);
		if (keys.length <= 3) {
			const preview = keys.map((k) => {
				const v = data[k];
				if (typeof v === "string" && v.length > 30) return `${k}: "${v.slice(0, 30)}..."`;
				if (typeof v === "string") return `${k}: "${v}"`;
				if (typeof v === "number" || typeof v === "boolean") return `${k}: ${v}`;
				if (Array.isArray(v)) return `${k}: [${v.length}]`;
				return `${k}: {...}`;
			});
			return { summary: `✓ ${preview.join(", ")}`, full: text };
		}

		return { summary: `✓ ${keys.length} fields`, full: text };
	} catch {
		// Not JSON - summarize as text
		if (text.length <= 100) {
			return { summary: text, full: text };
		}
		const lines = text.split("\n").length;
		return { summary: `✓ ${lines} lines, ${text.length} chars`, full: text };
	}
}

/**
 * Formats a tool-proxy result into standard tool result format.
 * @param result - Raw result from tool-proxy
 * @param concise - Whether to generate a concise summary for display (full content still in context)
 * @param app - App name for app-specific summarization
 * @param tool - Tool name for app-specific summarization
 * @returns Formatted tool result with content array
 */
function formatResult(result: unknown, concise = false, app?: string, tool?: string) {
	const r = result as ToolProxyResult;
	const content = r?.content;
	const hasContent = Array.isArray(content) && content.length > 0;

	const rawText = hasContent
		? content.map((c) => c.text || JSON.stringify(c)).join("\n")
		: JSON.stringify(result, null, 2);

	if (concise) {
		const { summary } = summarizeResult(rawText, app, tool);
		// Full content goes to LLM, summary is for display only
		return {
			details: { _summary: summary },
			content: [{ type: "text" as const, text: rawText }],
		};
	}

	return {
		details: {},
		content: hasContent
			? content.map((c) => ({ type: "text" as const, text: c.text || JSON.stringify(c) }))
			: [{ type: "text" as const, text: JSON.stringify(result) }],
	};
}

/**
 * Registers tool-proxy bridge tools (discover_tools, execute_tool, list_apps, etc.).
 * Also sets up status indicator and output summarization.
 * @param pi - Extension API for registering tools and event handlers
 */
export default function (pi: ExtensionAPI) {
	// Register status indicator, output summarization, and docs gate
	toolProxyStatus(pi);
	toolProxySummary(pi);
	intentLogger(pi);
	patternAnalyzer(pi);
	docsGate(pi);
	// Register discover_tools
	pi.registerTool({
		name: "discover_tools",
		label: "Discover Tools",
		description: `Find relevant tools from tool-proxy for a task. Call this before using external services like GitHub, Linear, Notion, etc.

WHEN TO USE:
- Need to interact with external service (GitHub, Linear, Notion, Vercel, etc.)
- Don't know exact tool name or parameters
- First time using a service in this session

WORKFLOW: discover_tools -> execute_tool`,
		parameters: Type.Object({
			query: Type.String({
				description: 'What you want to do, e.g., "create github issue" or "deploy to vercel"',
			}),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			try {
				const result = await callTool("discover_tools", {
					query: params.query,
					format: "markdown",
					project_cwd: ctx.cwd,
				});
				return formatResult(result);
			} catch (error: unknown) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("tool-proxy: ")) +
					theme.fg("muted", "discover_tools ") +
					theme.fg("accent", `"${args.query}"`),
				0,
				0
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as { _fullText?: string } | undefined;
			const textContent = result.content.find((c: { type: string }) => c.type === "text") as
				| { text: string }
				| undefined;
			const summary = textContent?.text ?? "✓ done";

			if (expanded && details?._fullText) {
				return new Text(`${summary}\n\n${theme.fg("dim", details._fullText)}`, 0, 0);
			}

			return new Text(theme.fg("success", summary), 0, 0);
		},
	});

	// Register execute_tool
	pi.registerTool({
		name: "execute_tool",
		label: "Execute Tool",
		description: `Execute a tool discovered via discover_tools. Requires app name, tool name, and arguments.

WHEN TO USE:
- After discover_tools found the right tool
- Know exact app/tool/args from previous usage
- Calling external APIs (GitHub, Linear, etc.)`,
		parameters: Type.Object({
			app: Type.String({ description: 'App name, e.g., "github", "notion", "vercel"' }),
			tool: Type.String({ description: 'Tool name, e.g., "create_issue", "get_page"' }),
			args: Type.Optional(Type.Object({}, { additionalProperties: true, description: "Tool arguments" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			try {
				const result = await callTool("execute_tool", {
					app: params.app,
					tool: params.tool,
					args: params.args || {},
					project_cwd: ctx.cwd,
				});
				// Use concise formatting with app-specific summarization
				return formatResult(result, true, params.app, params.tool);
			} catch (error: unknown) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("tool-proxy: ")) +
					theme.fg("muted", "execute_tool ") +
					theme.fg("accent", `${args.app}/`) +
					theme.fg("warning", args.tool),
				0,
				0
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as { _summary?: string } | undefined;
			const textContent = result.content.find((c: { type: string }) => c.type === "text") as
				| { text: string }
				| undefined;
			const fullText = textContent?.text ?? "";
			const summary = details?._summary ?? "✓ done";

			if (expanded) {
				// Show full content when expanded (Ctrl+O)
				return new Text(`${summary}\n\n${theme.fg("dim", fullText)}`, 0, 0);
			}

			return new Text(summary, 0, 0);
		},
	});

	// Register list_apps
	pi.registerTool({
		name: "list_apps",
		label: "List Apps",
		description: "List all available apps in tool-proxy and their tools.",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			try {
				const result = await callTool("list_apps", {
					project_cwd: ctx.cwd,
				});
				return formatResult(result);
			} catch (error: unknown) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
					isError: true,
				};
			}
		},

		renderCall(_args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("tool-proxy: ")) + theme.fg("muted", "list_apps"), 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as { _fullText?: string } | undefined;
			const textContent = result.content.find((c: { type: string }) => c.type === "text") as
				| { text: string }
				| undefined;
			const summary = textContent?.text ?? "✓ done";

			if (expanded && details?._fullText) {
				return new Text(`${summary}\n\n${theme.fg("dim", details._fullText)}`, 0, 0);
			}

			return new Text(theme.fg("success", summary), 0, 0);
		},
	});

	// Register get_app_context
	pi.registerTool({
		name: "get_app_context",
		label: "Get App Context",
		description: "Get full documentation for a tool-proxy app.",
		parameters: Type.Object({
			app: Type.String({ description: 'App name, e.g., "github", "notion"' }),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			try {
				const result = await callTool("get_app_context", { app: params.app });
				return formatResult(result);
			} catch (error: unknown) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("tool-proxy: ")) +
					theme.fg("muted", "get_app_context ") +
					theme.fg("accent", args.app),
				0,
				0
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as { _fullText?: string } | undefined;
			const textContent = result.content.find((c: { type: string }) => c.type === "text") as
				| { text: string }
				| undefined;
			const summary = textContent?.text ?? "✓ done";

			if (expanded && details?._fullText) {
				return new Text(`${summary}\n\n${theme.fg("dim", details._fullText)}`, 0, 0);
			}

			return new Text(theme.fg("success", summary), 0, 0);
		},
	});

	// Register execute_code
	pi.registerTool({
		name: "execute_code",
		label: "Execute Code",
		description: `Execute AI-generated TypeScript code in a sandboxed environment with optional npm packages.

WHEN TO USE:
- Complex data transformations
- Calculations or algorithms
- Testing code snippets
- Processing that's easier in code than tool calls

SANDBOX: Runs in isolated container with network access only to allowed domains.`,
		parameters: Type.Object({
			code: Type.String({ description: "TypeScript code to execute" }),
			packages: Type.Optional(
				Type.Array(Type.String(), {
					description: 'npm packages to install (e.g., ["lodash", "axios@1.6.0"])',
				})
			),
			allowedDomains: Type.Optional(
				Type.Array(Type.String(), {
					description: "Network domains to allow access to",
				})
			),
			timeout: Type.Optional(Type.Number({ description: "Execution timeout in ms (max 300000, default 60000)" })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			try {
				const result = await callTool("execute_code", {
					code: params.code,
					packages: params.packages,
					allowedDomains: params.allowedDomains,
					timeout: params.timeout,
				});
				return formatResult(result);
			} catch (error: unknown) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			const preview = args.code.length > 50 ? `${args.code.slice(0, 50)}...` : args.code;
			return new Text(
				theme.fg("toolTitle", theme.bold("tool-proxy: ")) +
					theme.fg("muted", "execute_code ") +
					theme.fg("dim", preview.replace(/\n/g, " ")),
				0,
				0
			);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as { _fullText?: string } | undefined;
			const textContent = result.content.find((c: { type: string }) => c.type === "text") as
				| { text: string }
				| undefined;
			const summary = textContent?.text ?? "✓ done";

			if (expanded && details?._fullText) {
				return new Text(`${summary}\n\n${theme.fg("dim", details._fullText)}`, 0, 0);
			}

			return new Text(theme.fg("success", summary), 0, 0);
		},
	});

	// === Context Gate Enforcement ===
	// Block execute_tool if get_app_context wasn't called for that app
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "execute_tool") return;

		const input = event.input as { app?: string } | undefined;
		const app = input?.app;
		if (!app) return;

		if (!hasAppContext(app, ctx)) {
			return {
				block: true,
				reason: `Call get_app_context("${app}") first to load usage instructions before executing tools.`,
			};
		}
	});

	// === System Prompt Context ===
	// Inject static context (paths, secrets architecture, workflow) into system prompt
	pi.on("before_agent_start", async (event, _ctx) => {
		const context = getStaticContext();
		if (!context) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${context}`,
		};
	});

	// Cleanup on shutdown
	pi.on("session_shutdown", async () => {
		await closeClient();
	});
}
