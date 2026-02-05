/**
 * Enhanced read tool with:
 * - Compact display for large files (LLM sees full content)
 * - Special rendering for SKILL.md files
 *
 * Call:     read index.ts
 * Loading:  ...
 * Complete: ✓ index.ts (150 lines, 4.2KB)
 * Skill:    📚 skill: git (collapsed by default)
 */
import { createReadTool, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, visibleWidth } from "@mariozechner/pi-tui";

const SUMMARY_MARKER = "__summarized_read__";
const MIN_SIZE_TO_SUMMARIZE = 500; // bytes

/** Check if path is a skill file */
function isSkillPath(path: string): boolean {
  return path.includes("/skills/") && path.endsWith("SKILL.md");
}

/** Extract skill name from path */
function getSkillName(path: string): string {
  const match = path.match(/\/skills\/([^/]+)\/SKILL\.md$/);
  return match?.[1] ?? "unknown";
}

/** Check if content looks like a skill file */
function isSkillContent(content: string): boolean {
  return (
    content.startsWith("---") &&
    content.includes("\nname:") &&
    content.includes("\ndescription:")
  );
}

export default function readSummary(pi: ExtensionAPI): void {
  const baseReadTool = createReadTool(process.cwd());

  pi.registerTool({
    name: "read",
    label: baseReadTool.label,
    description: baseReadTool.description,
    parameters: baseReadTool.parameters,

    renderCall(args, theme) {
      const path = args.path ?? "file";
      const filename = path.split("/").pop() ?? path;

      // Skill file: special rendering
      if (isSkillPath(path)) {
        const skillName = getSkillName(path);
        const left = theme.fg("accent", `📚 skill: ${skillName}`);
        const right = theme.fg("dim", "ctrl+o to expand");

        return {
          render(width: number): string[] {
            const leftWidth = visibleWidth(left);
            const rightWidth = visibleWidth(right);
            const gap = width - leftWidth - rightWidth;
            if (gap >= 2) {
              return [left + " ".repeat(gap) + right];
            }
            return [left];
          },
          invalidate() {},
        };
      }

      // Normal file
      return new Text(
        theme.fg("toolTitle", theme.bold("read ")) + theme.fg("muted", filename),
        0,
        0
      );
    },

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const path = params.path ?? "file";
      const filename = path.split("/").pop() ?? path;

      // Show loading state
      onUpdate?.({
        content: [{ type: "text", text: `reading ${filename}...` }],
        details: { _loading: true, _filename: filename },
      });

      // Call original implementation
      // baseReadTool uses old signature: (toolCallId, params, signal, onUpdate)
      const result = await baseReadTool.execute(toolCallId, params, signal, onUpdate);

      // Check if we should summarize
      const textContent = result.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") return result;

      const fullText = textContent.text;

      // Don't summarize small files
      if (fullText.length < MIN_SIZE_TO_SUMMARIZE) return result;

      // Calculate stats
      const lines = fullText.split("\n").length;
      const sizeKb = (fullText.length / 1024).toFixed(1);
      const summary = `${filename} (${lines} lines, ${sizeKb}KB)`;

      return {
        content: [{ type: "text", text: summary }],
        details: {
          ...(typeof result.details === "object" ? result.details : {}),
          [SUMMARY_MARKER]: true,
          _fullText: fullText,
          _path: path,
          _filename: filename,
          _isSkill: isSkillContent(fullText),
        },
      };
    },

    renderResult(result, { expanded, isPartial }, theme) {
      const details = result.details as {
        _loading?: boolean;
        _filename?: string;
        _fullText?: string;
        _isSkill?: boolean;
        [SUMMARY_MARKER]?: boolean;
      } | undefined;

      const textContent = result.content.find((c: { type: string }) => c.type === "text") as
        | { text: string }
        | undefined;

      // Loading state
      if (isPartial || details?._loading) {
        return new Text(theme.fg("muted", "..."), 0, 0);
      }

      // Skill file: collapsed by default, show full on expand
      if (details?._isSkill) {
        if (expanded && details?._fullText) {
          return new Text(details._fullText, 0, 0);
        }
        return new Text("", 0, 0); // Collapsed - info is in renderCall
      }

      // If not summarized, show raw content
      if (!details?.[SUMMARY_MARKER]) {
        return new Text(textContent?.text ?? "", 0, 0);
      }

      const summary = textContent?.text ?? "file";

      // Expanded view shows full content
      if (expanded && details?._fullText) {
        return new Text(
          theme.fg("muted", "✓ " + summary) + "\n\n" + theme.fg("dim", details._fullText),
          0,
          0
        );
      }

      return new Text(theme.fg("muted", "✓ " + summary), 0, 0);
    },
  });

  // Restore full content for LLM context
  pi.on("context", async (event, _ctx) => {
    const messages = event.messages;
    let modified = false;

    for (const msg of messages) {
      if (msg.role !== "toolResult") continue;

      const details = msg.details as Record<string, unknown> | undefined;
      if (!details?.[SUMMARY_MARKER] || !details._fullText) continue;

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
