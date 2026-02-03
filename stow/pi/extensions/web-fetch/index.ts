/**
 * WebFetch Extension for Pi
 *
 * Fetches web content with automatic fallback to Firecrawl when content is truncated.
 *
 * Options:
 * - maxBytes: Truncation limit (default 50KB)
 * - useFirecrawlOnTruncate: Fall back to Firecrawl if truncated (default true)
 * - format: "text" | "markdown" | "html" (default "text", Firecrawl returns markdown)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const DEFAULT_MAX_BYTES = 50_000;

// Try to use tool-proxy's Firecrawl if available
async function tryFirecrawl(url: string, _ctx: any): Promise<string | null> {
	try {
		// Import dynamically to avoid hard dependency
		const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
		const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

		const baseUrl = process.env.TOOL_PROXY_URL || "http://localhost:3100";
		const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
		const client = new Client({ name: "pi-web-fetch", version: "1.0.0" });

		await client.connect(transport);

		try {
			const result = await client.callTool({
				name: "execute_tool",
				arguments: {
					app: "firecrawl",
					tool: "firecrawl_scrape",
					args: {
						url,
						formats: ["markdown"],
						onlyMainContent: true,
					},
				},
			});

			const content = (result as any)?.content;
			if (Array.isArray(content) && content.length > 0) {
				const text = content.find((c: any) => c.type === "text")?.text;
				if (text && !text.includes("[TOOL_ERROR]")) {
					return text;
				}
			}
			return null;
		} finally {
			await client.close();
		}
	} catch (_e) {
		// Firecrawl not available
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web-fetch",
		label: "WebFetch",
		description: `Fetch content from a URL. If content exceeds the limit and Firecrawl is available via tool-proxy, automatically uses Firecrawl for better extraction.

WHEN TO USE:
- Need to read web page content
- Fetching documentation or articles
- Checking API responses

AUTOMATIC FIRECRAWL FALLBACK:
- Triggers when content exceeds maxBytes (default 50KB)
- Firecrawl extracts clean markdown from complex pages
- Requires tool-proxy running with Firecrawl configured`,
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch" }),
			maxBytes: Type.Optional(Type.Number({ description: "Max bytes before truncation (default 50KB)" })),
			useFirecrawlOnTruncate: Type.Optional(
				Type.Boolean({
					description: "Fall back to Firecrawl if content is truncated (default true)",
				})
			),
			format: Type.Optional(
				Type.Union([Type.Literal("text"), Type.Literal("markdown"), Type.Literal("html")], {
					description: 'Output format: "text" (default), "markdown", or "html"',
				})
			),
		}),

		async execute(_toolCallId, params, onUpdate, ctx, signal) {
			const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;
			const useFirecrawlOnTruncate = params.useFirecrawlOnTruncate ?? true;
			const _format = params.format ?? "text";

			try {
				// First, try a simple fetch
				const response = await fetch(params.url, {
					signal,
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					},
				});

				if (!response.ok) {
					return {
						content: [{ type: "text", text: `HTTP ${response.status}: ${response.statusText}` }],
						details: { status: response.status, url: params.url, isError: true },
					};
				}

				const contentType = response.headers.get("content-type") || "";
				const isHtml = contentType.includes("text/html");
				const fullText = await response.text();
				const totalBytes = new TextEncoder().encode(fullText).length;
				const truncated = totalBytes > maxBytes;

				// If truncated and Firecrawl fallback is enabled, try Firecrawl
				if (truncated && useFirecrawlOnTruncate && isHtml) {
					onUpdate?.({
						details: {},
						content: [
							{
								type: "text",
								text: `Content truncated (${(totalBytes / 1024).toFixed(1)}KB > ${(maxBytes / 1024).toFixed(1)}KB). Trying Firecrawl...`,
							},
						],
					});

					const firecrawlResult = await tryFirecrawl(params.url, ctx);
					if (firecrawlResult) {
						return {
							content: [{ type: "text", text: firecrawlResult }],
							details: {
								url: params.url,
								source: "firecrawl",
								originalBytes: totalBytes,
								format: "markdown",
							},
						};
					}
					// Firecrawl failed - will fall through to truncated response
				}

				// Return truncated content with notice
				let content = truncated ? fullText.slice(0, maxBytes) : fullText;

				if (truncated) {
					content += `\n\n[Truncated: showing ${(maxBytes / 1024).toFixed(1)}KB of ${(totalBytes / 1024).toFixed(1)}KB]`;
					if (!useFirecrawlOnTruncate) {
						content += "\n[Tip: Set useFirecrawlOnTruncate=true to get full content via Firecrawl]";
					} else if (isHtml) {
						content += "\n[Firecrawl fallback failed or unavailable]";
					}
				}

				return {
					content: [{ type: "text", text: content }],
					details: {
						url: params.url,
						status: response.status,
						contentType,
						totalBytes,
						truncated,
						source: "fetch",
					},
				};
			} catch (error: any) {
				return {
					content: [{ type: "text", text: `Fetch error: ${error.message}` }],
					details: { url: params.url, error: error.message, isError: true },
				};
			}
		},

		renderCall(args, theme) {
			const url = args.url.length > 60 ? `${args.url.slice(0, 60)}...` : args.url;
			return new Text(theme.fg("toolTitle", theme.bold("web-fetch ")) + theme.fg("accent", url), 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as any;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			let summary = "";
			if (details.isError) {
				summary = theme.fg("error", "✗ ") + theme.fg("error", details.error || "Failed");
			} else {
				const source = details.source === "firecrawl" ? " via Firecrawl" : "";
				const size = details.totalBytes ? ` (${(details.totalBytes / 1024).toFixed(1)}KB)` : "";
				const truncNote = details.truncated && details.source !== "firecrawl" ? " [truncated]" : "";
				summary =
					theme.fg("success", "✓ ") + theme.fg("dim", details.url) + theme.fg("muted", size + source + truncNote);
			}

			if (expanded && !details.isError) {
				const text = result.content[0];
				const content = text?.type === "text" ? text.text : "";
				const preview = content.slice(0, 500) + (content.length > 500 ? "..." : "");
				summary += `\n${theme.fg("dim", preview)}`;
			}

			return new Text(summary, 0, 0);
		},
	});
}
