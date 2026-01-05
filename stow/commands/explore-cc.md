---
description: Display Claude Code tools, subagents, and output styles as TypeScript interfaces
---

# Explore Claude Code Command

## Purpose

Output a comprehensive reference of Claude Code's built-in capabilities in TypeScript interface format, including all default tools, subagent types, and output styles.

## Process Flow

### Step 1: Output Tools as TypeScript Interfaces

Display all default Claude Code tools with their parameters as TypeScript interfaces:

```typescript
interface BashTool {
  command: string
  description?: string
  timeout?: number // max 600000ms
  run_in_background?: boolean
}

interface ReadTool {
  file_path: string // absolute path required
  offset?: number // line number to start from
  limit?: number // number of lines to read
}

interface WriteTool {
  file_path: string // absolute path required
  content: string
}

interface EditTool {
  file_path: string // absolute path required
  old_string: string
  new_string: string
  replace_all?: boolean // default false
}

interface GlobTool {
  pattern: string // e.g., "**/*.ts", "src/**/*.tsx"
  path?: string // directory to search in
}

interface GrepTool {
  pattern: string // regex pattern
  path?: string // file or directory to search
  glob?: string // filter files by pattern
  type?: string // file type: js, py, rust, go, etc.
  output_mode?: "content" | "files_with_matches" | "count"
  multiline?: boolean
  "-i"?: boolean // case insensitive
  "-n"?: boolean // show line numbers
  "-A"?: number // lines after match
  "-B"?: number // lines before match
  "-C"?: number // lines around match
  head_limit?: number
  offset?: number
}

interface TaskTool {
  prompt: string
  description: string // 3-5 words
  subagent_type: string
  model?: "sonnet" | "opus" | "haiku"
  run_in_background?: boolean
  resume?: string // agent ID to resume
}

interface TaskOutputTool {
  task_id: string
  block?: boolean // default true
  timeout?: number // max 600000ms
}

interface WebFetchTool {
  url: string // full URL required
  prompt: string // what to extract from page
}

interface WebSearchTool {
  query: string
  allowed_domains?: string[]
  blocked_domains?: string[]
}

interface NotebookEditTool {
  notebook_path: string // absolute path
  new_source: string
  cell_id?: string
  cell_type?: "code" | "markdown"
  edit_mode?: "replace" | "insert" | "delete"
}

interface TodoWriteTool {
  todos: Array<{
    content: string
    status: "pending" | "in_progress" | "completed"
    activeForm: string // present continuous form
  }>
}

interface AskUserQuestionTool {
  questions: Array<{
    question: string
    header: string // max 12 chars
    options: Array<{ label: string; description: string }>
    multiSelect: boolean
  }>
}

interface KillShellTool {
  shell_id: string
}

interface SkillTool {
  skill: string
  args?: string
}

interface EnterPlanModeTool {}

interface ExitPlanModeTool {}
```

### Step 2: Output Subagent Types

List all built-in subagent types for the Task tool:

```typescript
type SubagentType =
  | "general-purpose"  // Complex multi-step tasks, code search, research
  | "Explore"          // Fast codebase exploration, file patterns, keyword search
  | "Plan"             // Software architect for implementation planning
  | "claude-code-guide" // Claude Code documentation and usage questions
  | "git-buddy"        // Git workflow: commits, PRs, version bumping
  | "statusline-setup" // Configure status line settings
```

### Step 3: Output Default Output Styles

List Claude Code's built-in output styles:

```typescript
type OutputStyle =
  | "concise"    // Brief, minimal responses
  | "detailed"   // Comprehensive explanations
  | "formal"     // Professional tone
  | "educational" // Teaching-focused with context
```

## Notes

- Tools require specific parameter types - check interfaces before use
- Subagents have access to different tool subsets based on their purpose
- Output styles affect response formatting, not tool behavior
