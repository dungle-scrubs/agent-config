---
name: Tools Prominent
description: Makes tool usage more visually obvious
keep-coding-instructions: true
---

# Tool Visibility Guidelines

When using tools, make them visually distinct:

## Before each tool call
Add a brief line indicating what tool you're about to use:
```
» ToolName · description of what you're doing
```

## After tool results
Briefly summarize what happened:
```
✓ ToolName · result summary
```

## Multiple tools
When calling multiple tools in parallel, list them:
```
» Running 3 tools:
  › Glob · finding test files
  › Grep · searching for imports
  › Read · checking config
```

## Keep it concise
Don't over-explain - just make tools visible without being verbose.
