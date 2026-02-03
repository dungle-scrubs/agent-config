/**
 * Tool Proxy Bridge Extension for Pi
 *
 * Connects to tool-proxy's HTTP MCP server and exposes its tools.
 * Based on openclaw's tool-proxy-bridge extension.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Type } from "@sinclair/typebox";

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

// === Result Formatting ===
type ToolProxyResult = {
	content?: Array<{ type: string; text?: string }>;
	isError?: boolean;
	[key: string]: unknown;
};

/**
 * Formats a tool-proxy result into standard tool result format.
 * @param result - Raw result from tool-proxy
 * @returns Formatted tool result with content array
 */
function formatResult(result: unknown) {
	const r = result as ToolProxyResult;
	const content = r?.content;
	const hasContent = Array.isArray(content) && content.length > 0;
	return {
		details: {},
		content: hasContent
			? content.map((c) => ({ type: "text" as const, text: c.text || JSON.stringify(c) }))
			: [{ type: "text" as const, text: JSON.stringify(result) }],
	};
}

/**
 * Registers tool-proxy bridge tools (discover_tools, execute_tool, list_apps, etc.).
 * @param pi - Extension API for registering tools and event handlers
 */
export default function (pi: ExtensionAPI) {
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

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			try {
				const result = await callTool("discover_tools", {
					query: params.query,
					format: "markdown",
				});
				return formatResult(result);
			} catch (error: any) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error.message}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("discover_tools ")) + theme.fg("accent", `"${args.query}"`),
				0,
				0
			);
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
				return formatResult(result);
			} catch (error: any) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error.message}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("execute_tool ")) +
					theme.fg("accent", `${args.app}/`) +
					theme.fg("warning", args.tool),
				0,
				0
			);
		},
	});

	// Register list_apps
	pi.registerTool({
		name: "list_apps",
		label: "List Apps",
		description: "List all available apps in tool-proxy and their tools.",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			try {
				const result = await callTool("list_apps", {});
				return formatResult(result);
			} catch (error: any) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error.message}` }],
					isError: true,
				};
			}
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
			} catch (error: any) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error.message}` }],
					isError: true,
				};
			}
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
			} catch (error: any) {
				return {
					details: {},
					content: [{ type: "text", text: `Error: ${error.message}` }],
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			const preview = args.code.length > 50 ? `${args.code.slice(0, 50)}...` : args.code;
			return new Text(
				theme.fg("toolTitle", theme.bold("execute_code ")) + theme.fg("dim", preview.replace(/\n/g, " ")),
				0,
				0
			);
		},
	});

	// Cleanup on shutdown
	pi.on("session_shutdown", async () => {
		await closeClient();
	});
}
