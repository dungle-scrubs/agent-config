---
name: obsidian
description: "Add information to Obsidian code vault. Use when user says add to notes, save to notes, remember this, or note this down."
---

# Obsidian Code Vault

Add information to the Obsidian vault at `~/obsidian/vaults/code/`.

## Vault Structure

The vault uses a topic-based organization:

- **Topic files** at root: `python.md`, `css.md`, `authentication.md`, etc.
- **Topic folders** for larger subjects: `typescript/` with subtopic files like `basics.md`, `tsconfig.json.md`
- **Project folders**: `Fusion/`, `reviewsion/`, etc.

## Workflow

1. **Understand the content** - What topic does this information belong to?

2. **Search for existing location** - Use Glob and Grep to find:
   - Existing topic file that matches (e.g., `python.md` for Python content)
   - Existing topic folder with relevant subtopics (e.g., `typescript/`)
   - Related content that suggests where this belongs

3. **Read for context** - Before writing, read the target file to:
   - Understand the existing format and style
   - Find the appropriate section or heading
   - Avoid duplicating existing content

4. **Determine placement**:
   - If a matching topic file exists → append to appropriate section
   - If a topic folder exists → add to relevant subtopic file or create new one
   - If no match → create new topic file at root
   - If unclear → use AskUserQuestion to clarify

5. **Write the content** - Match the existing format of the target file

## Format Guidelines

Observe the target file's format. Common patterns in this vault:

- Headers use `##` for main sections
- Code blocks with language tags
- Tables for comparisons
- Bullet lists for collections
- Links in format `[Title](URL)` or `- [Title](URL)`

### Callouts

Use Obsidian callouts for highlighting important information:

```markdown
> [!tip] Always expanded
> Content here

> [!note]- Collapsed by default
> Content here

> [!warning]+ Expanded by default
> Content here
```

**Types:** `tip`, `note`, `warning`, `error`, `bug`, `info`, `question`, `example`

**Modifiers:**
- No suffix: always expanded
- `-`: collapsed by default
- `+`: expanded by default

Use callouts for:
- Important warnings or gotchas
- Tips and best practices
- Code examples that need context
- Errors and bugs to watch out for

## Examples

<example>
Context: User learned about Python virtual environments

User: "Add to notes: uv is faster than pip for creating venvs"

Steps:
1. Search: Find `python.md` exists
2. Read: See it has sections on Python environment, venv, uv
3. Write: Append to the relevant section matching existing format
</example>

<example>
Context: User discovered a TypeScript config option

User: "Note this down - tsconfig paths need baseUrl set first"

Steps:
1. Search: Find `typescript/tsconfig.json.md` exists
2. Read: Check existing content and format
3. Write: Add to appropriate section
</example>

<example>
Context: User wants to save info about a new topic

User: "Add to notes: Docker compose healthcheck syntax"

Steps:
1. Search: No docker.md or docker/ found
2. Ask: "Should I create a new `docker.md` file, or add this to an existing file?"
3. Write: Based on user response
</example>

## Error Handling

- **File not found**: Create new topic file at vault root
- **Unclear placement**: Ask user with AskUserQuestion
- **Format mismatch**: Adapt to target file's existing style
