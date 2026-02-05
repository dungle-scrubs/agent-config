/**
 * Compact display for get_app_context while preserving full LLM context.
 *
 * Strategy:
 * 1. tool_result: Store full text in details, replace content with summary
 * 2. context: Restore full text for LLM before API call
 *
 * Result: Display shows "📖 Linear (12 tools)", LLM sees full docs.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** Marker for our modified results */
const SUMMARY_MARKER = "__summarized_tool_result__";

/** Tools to summarize */
const TOOLS_TO_SUMMARIZE = new Set([
  "get_app_context",
  "execute_tool",
  "discover_tools",
  "list_apps",
  "execute_code",
]);

/**
 * Summarizes execute_tool results into a compact string.
 */
function summarizeExecuteToolResult(fullText: string, input: { app?: string; tool?: string }): string {
  const app = input?.app ?? "?";
  const tool = input?.tool ?? "?";
  const sizeKb = (fullText.length / 1024).toFixed(1);

  // Try to parse as JSON to extract meaningful info
  try {
    const data = JSON.parse(fullText);

    // GitHub-style: { total_count, items: [...] }
    if (typeof data.total_count === "number" && Array.isArray(data.items)) {
      return `✓ ${app}/${tool} → ${data.items.length} of ${data.total_count} results (${sizeKb}KB)`;
    }

    // Array response
    if (Array.isArray(data)) {
      return `✓ ${app}/${tool} → ${data.length} items (${sizeKb}KB)`;
    }

    // Object with id (single item)
    if (data.id || data.name || data.title) {
      const label = data.title || data.name || `#${data.id}`;
      return `✓ ${app}/${tool} → "${label}" (${sizeKb}KB)`;
    }

    // Generic object
    const keys = Object.keys(data).length;
    return `✓ ${app}/${tool} → object with ${keys} fields (${sizeKb}KB)`;
  } catch {
    // Not JSON, just show size
    const lines = fullText.split("\n").length;
    return `✓ ${app}/${tool} → ${lines} lines (${sizeKb}KB)`;
  }
}

/**
 * Registers tool output summarization for verbose tool-proxy results.
 * @param pi - The Pi extension API
 */
export default function toolProxySummary(pi: ExtensionAPI): void {
  // Step 1: Intercept tool results - store full text, display summary
  pi.on("tool_result", async (event, _ctx) => {
    if (!TOOLS_TO_SUMMARIZE.has(event.toolName)) return;

    const textContent = event.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") return;

    const fullText = textContent.text;
    if (fullText.length < 500) return; // Don't bother for small outputs

    let summary: string;

    const sizeKb = (fullText.length / 1024).toFixed(1);

    switch (event.toolName) {
      case "get_app_context": {
        const appNameMatch = fullText.match(/^#\s*(.+?)(?:\s+MCP)?$/m);
        const appName = appNameMatch?.[1] ?? "App";
        const toolCount = (fullText.match(/- \*\*[\w_]+\*\*/g) || []).length;
        summary = `📖 ${appName} (${toolCount} tools, ${sizeKb}KB)`;
        break;
      }
      case "execute_tool": {
        summary = summarizeExecuteToolResult(fullText, event.input as { app?: string; tool?: string });
        break;
      }
      case "discover_tools": {
        const toolMatches = fullText.match(/\d+\.\s+\*\*[\w-]+:[\w_]+\*\*/g) || [];
        const query = (event.input as { query?: string })?.query ?? "";
        summary = `🔍 "${query}" → ${toolMatches.length} tools found (${sizeKb}KB)`;
        break;
      }
      case "list_apps": {
        const appCount = (fullText.match(/^  • /gm) || []).length;
        summary = `📋 ${appCount} apps available (${sizeKb}KB)`;
        break;
      }
      case "execute_code": {
        const lines = fullText.split("\n").length;
        const hasError = fullText.toLowerCase().includes("error");
        summary = hasError
          ? `⚠️ code execution error (${lines} lines, ${sizeKb}KB)`
          : `✓ code executed (${lines} lines, ${sizeKb}KB)`;
        break;
      }
      default:
        return; // Unknown tool, don't modify
    }

    return {
      content: [{ type: "text", text: summary }],
      details: {
        ...(typeof event.details === "object" && event.details !== null ? event.details : {}),
        [SUMMARY_MARKER]: true,
        _fullText: fullText,
      },
      isError: event.isError,
    };
  });

  // Step 2: Before LLM call - restore full text in context
  pi.on("context", async (event, _ctx) => {
    const messages = event.messages;
    let modified = false;

    for (const msg of messages) {
      if (msg.role !== "toolResult") continue;

      const details = msg.details as Record<string, unknown> | undefined;
      if (!details?.[SUMMARY_MARKER] || !details._fullText) continue;

      // Find and restore the text content
      const textContent = msg.content.find(
        (c): c is { type: "text"; text: string } => c.type === "text"
      );
      if (textContent) {
        textContent.text = details._fullText as string;
        modified = true;
      }
    }

    if (modified) {
      return { messages };
    }
  });
}
