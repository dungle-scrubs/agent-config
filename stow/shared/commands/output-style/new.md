---
description: Create a new output style using the validated template from standards
argument-hint: [scope] [prompt]
---

# Create Output Style Command

## Purpose

Creates a new Claude Code output style file using the standardized template with built-in validation guidance. This command ensures output styles are created with proper formatting and in the correct location.

**Key Concept**: Output styles are "stored system prompts" that modify how Claude communicates. Unlike CLAUDE.md (added as user message) or commands (user-invoked prompts), output styles directly replace Claude's default system prompt behavior.

## Variables

- **scope**: Optional. Set to "user" or "User" to create at user level (~/.claude/output-styles/). Omit or use any other value for project level (./.claude/output-styles/). Can also be specified in prompt text as "make this user level"
- **prompt**: The description or details of the output style to create. Used to gather style information including name, description, and communication patterns

## Usage Pattern

```text
@~/.claude/commands/output-style/new.md [user] [style details...]
```

### Scope Flag

- First argument can be "user" or "User" to create at user level
- Any other value or omission defaults to project level
- Can also specify "make this user level" in the query text

## Prerequisites

- Template exists at `~/.claude/commands/output-style/_template.md`
- file-creator agent is available
- User has decided on style scope (global vs project)

## Process Flow

### Step 1: Parse Scope Flag

Check if first argument is "user" or "User":

- If yes: Set scope to user level (global)
- If no: Set scope to project level (default)
- Also check query for "make this user level"

### Step 2: Gather Output Style Information

Prompt the user for:

- **Style name** (human-readable display name, no quotes)
- **File name** (kebab-case for the .md file)
- **Description** (brief, for /output-style menu - **CRITICAL: NO QUOTES AT ALL**)
- **keep-coding-instructions** (true for coding-related styles, false for non-coding uses)
- **Core identity** (who/what Claude should be in this style)
- **Communication patterns** (how Claude should communicate)
- **Behavior guidelines** (specific behaviors to follow)

### Step 3: Determine Target Location

Based on scope from Step 1:

- **User level (global)**: `~/.claude/output-styles/[style-name].md`
- **Project level (default)**: `./.claude/output-styles/[style-name].md`

### Step 4: Load Template

Reference the enhanced template from:

```text
~/.claude/commands/output-style/_template.md
```

### Step 5: Delegate to file-creator

Pass the gathered information to the file-creator agent:

- Template to use
- Target location
- Substitution values
- Validation requirements

### Step 6: Confirm Creation

After file-creator completes:

- Verify file was created successfully
- Display location to user
- Provide usage instructions (`/output-style [name]`)

## Expected Outputs

### Success

```text
✅ Output style created successfully
📁 Location: ~/.claude/output-styles/my-style.md
📝 Usage: /output-style my-style
⚙️ Set default: Add "outputStyle": "my-style" to settings.json
```

### Error

```text
❌ Failed to create output style
Error: [Specific error message]
```

## Error Scenarios

- **Invalid description format**: Remind user to use no quotes
- **File already exists**: Ask if user wants to overwrite
- **Template not found**: Check commands directory structure
- **Invalid keep-coding-instructions**: Must be true or false

## Examples

<example>
Context: User wants to create a global technical expert style

User: "@~/.claude/commands/output-style/new.md user expert"

Assistant detects "user" flag and prompts:

- Name: Expert
- File name: expert.md
- Description: Technical expert focused on best practices and correctness
- keep-coding-instructions: true (coding-related)
- Core identity: Technical expert helping with software engineering
- Communication: Concise, technical, direct answers first

Result: Output style created at ~/.claude/output-styles/expert.md (user level)
</example>

<example>
Context: Creating a project-specific documentation writer style (default)

User: "@~/.claude/commands/output-style/new.md doc-writer"

Assistant (no "user" flag, defaults to project):

- Name: Documentation Writer
- File name: doc-writer.md
- Description: Creates clear technical documentation and guides
- keep-coding-instructions: false (documentation focus, not coding)
- Core identity: Technical writer creating user-friendly documentation
- Communication: Clear, structured, example-rich explanations

Result: Output style created at ./.claude/output-styles/doc-writer.md (project level)
</example>

<example>
Context: Creating a learning-focused style with coding preserved

User: "Create an output style for pair programming that teaches as it codes"

Assistant determines:

- Name: Pair Programmer
- File name: pair-programmer.md
- Description: Collaborative coding with explanations and teaching moments
- keep-coding-instructions: true (needs coding capabilities)
- Core identity: Senior developer pair programming with a junior
- Communication: Explains decisions, asks guiding questions, suggests improvements

Result: Style created with keep-coding-instructions: true
</example>

## Best Practices

- **CRITICAL**: Description field must have NO QUOTES (not double quotes, not single quotes)
- Use kebab-case for file names (e.g., `my-style.md`)
- Name can be human-readable (e.g., `My Style`)
- Set `keep-coding-instructions: true` for coding-related styles
- Set `keep-coding-instructions: false` for non-coding uses (writing, research, etc.)
- Define clear communication patterns and tone
- Include specific behavior guidelines
- Consider whether style should be global or project-specific

## Key Differences from Other Features

| Feature | How It Works |
|---------|-------------|
| **Output Style** | Replaces Claude's default system prompt behavior |
| **CLAUDE.md** | Added as user message after system prompt |
| **--append-system-prompt** | Appends to system prompt (doesn't replace) |
| **Slash Commands** | User-invoked prompts |
| **Agents** | Separate tools with own model/tools/context |

## Built-in Output Styles

Claude Code includes three built-in styles for reference:

1. **Default** - System prompt optimized for software engineering
2. **Explanatory** - Provides educational "Insights" between tasks
3. **Learning** - Collaborative mode with `TODO(human)` markers

## Related Commands

- `create-agent`: Create a new agent file
- `create-command`: Create a new command file
- `create-skill`: Create a new skill directory
- `file-creator`: The underlying agent that performs file creation

## Notes

This command creates Claude Code output styles - configurations that modify Claude's system prompt to adapt communication patterns for specific use cases.

Output styles are powerful because they change Claude's core behavior, not just add context. Use them when you need fundamentally different communication patterns (e.g., expert vs. teacher vs. researcher).

**When to use output styles vs CLAUDE.md:**

- **Output style**: When you want to change HOW Claude communicates
- **CLAUDE.md**: When you want to add project context or instructions

**Setting a default style:**

Add to `~/.claude/settings.json` or `.claude/settings.json`:

```json
{
  "outputStyle": "my-style"
}
```
