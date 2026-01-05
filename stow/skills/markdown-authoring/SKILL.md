---
name: markdown-authoring
description: Markdown formatting for new .md file creation (line length, spacing, frontmatter). Triggers: new markdown file, markdown formatting, .md file.
allowed-tools: Write, Edit, MultiEdit
---

# Markdown Authoring Standards

Apply these preferences when **creating new markdown files**. Do not modify existing
markdown files for formatting unless explicitly asked.

## Line Length

**80 character max for natural language only.**

### Must Wrap (natural language)

- Paragraphs
- List item descriptions
- Blockquotes

### Never Wrap (structural/code)

- Code blocks (``` fenced content)
- Inline code spans
- URLs and links
- Tables
- YAML frontmatter
- HTML tags
- Headings (keep on one line when possible)

### Breaking Strategy

1. Break at spaces between words
2. Prefer breaks after punctuation (., ,, ;)
3. Break before conjunctions (and, but, or)
4. Keep markdown syntax intact (don't break inside `[text](url)`)

## Spacing

### Headings

```markdown
## Previous Section

Content here.

## Next Section
```

- Blank line before headings
- Blank line after headings

### Code Fences

```markdown
Some text.

```javascript
const x = 1;
```

More text.
```

- Blank line before opening fence
- Blank line after closing fence

### Lists

- No blank lines between simple list items
- Blank line before/after list blocks

## Frontmatter

### Format

```yaml
---
key: value with no quotes unless special characters
description: Plain text description
list: item1, item2, item3
---
```

### Rules

- No quotes around values unless they contain `: ` or start with special YAML chars
- Comma-separated for simple lists (not YAML arrays)
- No trailing spaces

## What NOT to Do

- Don't add extra formatting beyond these rules
- Don't reorganize content structure
- Don't add comments or annotations
- Don't "improve" existing files unless asked
- Don't break lines that are already under 80 chars
