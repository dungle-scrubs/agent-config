# Pi Agent vs Claude Code: Lifecycle Hooks Comparison

## Claude Code `/init` Command

From the Claude Code memory docs:

> Bootstrap a CLAUDE.md for your codebase with the following command:
> ```
> > /init
> ```
> 
> Tips:
> - Include frequently used commands (build, test, lint) to avoid repeated searches
> - Document code style preferences and naming conventions
> - Add important architectural patterns specific to your project

So `/init` analyzes the project and generates a `CLAUDE.md` file with project context.

---

## Lifecycle Hooks Comparison

| Claude Code | Pi Agent | Notes |
|-------------|----------|-------|
| `SessionStart` | `session_start` | Session begins |
| `UserPromptSubmit` | `input` | Before processing prompt |
| `PreToolUse` | `tool_call` | Before tool executes (can block) |
| `PostToolUse` | `tool_result` | After tool executes |
| `PostToolUseFailure` | (in `tool_result` with `isError`) | After tool fails |
| `PermissionRequest` | (via `tool_call` blocking) | Permission handling |
| `Stop` | `agent_end` | Agent finishes responding |
| `PreCompact` | `session_before_compact` | Before compaction |
| `SessionEnd` | `session_shutdown` | Session ends |
| `SubagentStart/Stop` | (no direct equivalent) | Subagent lifecycle |
| — | `before_agent_start` | Can inject messages, modify system prompt |
| — | `turn_start` / `turn_end` | Per-LLM-turn granularity |
| — | `context` | Modify messages before LLM call |

---

## Key Differences

### Claude Code Hooks
- Configured via JSON settings files (`.claude/settings.json`, `~/.claude/settings.json`)
- Hooks are shell commands that receive JSON on stdin
- Uses matchers (regex) to filter when hooks fire
- Supports `type: "command"`, `type: "prompt"`, and `type: "agent"` handlers
- Can run hooks async in background

### Pi Agent Extensions
- Written in TypeScript as extension modules
- Use `pi.on("event_name", handler)` pattern
- Full access to `ExtensionContext` with UI methods, session manager, etc.
- Can register custom tools, commands, shortcuts
- More granular events (turn-level, context modification)

---

## Context Files

| Claude Code | Pi Agent |
|-------------|----------|
| `CLAUDE.md` | `AGENTS.md` (or `CLAUDE.md` as fallback) |
| `~/.claude/CLAUDE.md` (global) | `~/.pi/agent/AGENTS.md` (global) |
| `.claude/CLAUDE.md` (project) | `AGENTS.md` in cwd or parent dirs |
| `.claude/rules/*.md` (modular) | Skills in `.pi/skills/` |
| `CLAUDE.local.md` (personal) | (no direct equivalent) |

---

## Creating `/init` for Pi

To add a `/init` command to Pi that mirrors Claude Code's behavior, create an extension:

```typescript
// ~/.pi/agent/extensions/init.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("init", {
    description: "Initialize AGENTS.md for the current project",
    handler: async (args, ctx) => {
      // Check if AGENTS.md already exists
      // Analyze project structure
      // Generate AGENTS.md with:
      //   - Project overview
      //   - Common commands (build, test, lint)
      //   - Code style preferences
      //   - Architectural patterns
      // Write to ./AGENTS.md or ./.pi/AGENTS.md
    },
  });
}
```
