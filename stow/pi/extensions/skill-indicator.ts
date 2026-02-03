import type { ExtensionAPI, ExtensionContext, AgentToolUpdateCallback } from "@mariozechner/pi-coding-agent";
import { createReadTool } from "@mariozechner/pi-coding-agent";
import { Text, visibleWidth } from "@mariozechner/pi-tui";

/**
 * Checks if a path points to a skill file.
 * @param path - File path to check
 * @returns True if path is a SKILL.md file in a skills directory
 */
function isSkillPath(path: string): boolean {
  return path.includes("/skills/") && path.endsWith("SKILL.md");
}

/**
 * Extracts the skill name from a skill file path.
 * @param path - Path to SKILL.md file
 * @returns Skill name or "unknown" if pattern doesn't match
 */
function getSkillName(path: string): string {
  const match = path.match(/\/skills\/([^/]+)\/SKILL\.md$/);
  return match?.[1] ?? "unknown";
}

/**
 * Checks if content has skill frontmatter structure.
 * @param content - File content to check
 * @returns True if content looks like a skill file
 */
function isSkillContent(content: string): boolean {
  return content.startsWith("---") && 
         content.includes("\nname:") && 
         content.includes("\ndescription:");
}

/**
 * Overrides the read tool to show skill-specific UI when reading SKILL.md files.
 * @param pi - Extension API for registering tools
 */
export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const builtinRead = createReadTool(cwd);

  pi.registerTool({
    name: builtinRead.name,
    label: builtinRead.label,
    description: builtinRead.description,
    parameters: builtinRead.parameters,

    async execute(
      toolCallId: string,
      params: { path: string; offset?: number; limit?: number },
      onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
      signal?: AbortSignal
    ) {
      return builtinRead.execute(toolCallId, params, signal, onUpdate);
    },

    renderCall(args, theme) {
      if (isSkillPath(args.path)) {
        const skillName = getSkillName(args.path);
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
          invalidate() {}
        };
      }
      return new Text(theme.fg("toolTitle", "read ") + theme.fg("muted", args.path), 0, 0);
    },

    renderResult(result, options, theme) {
      const content = result.content?.[0]?.type === "text"
        ? (result.content[0] as { text: string }).text
        : "";

      if (isSkillContent(content)) {
        if (options.expanded) {
          return new Text(content, 0, 0);
        }
        return new Text("", 0, 0);
      }

      if (options.expanded) {
        return new Text(content, 0, 0);
      }

      const lines = content.split("\n");
      const preview = lines.slice(0, 8).join("\n");
      const remaining = lines.length - 8;
      const suffix = remaining > 0 
        ? theme.fg("dim", `\n... (${remaining} more lines, ctrl+o to expand)`)
        : "";
      return new Text(preview + suffix, 0, 0);
    },
  });
}
