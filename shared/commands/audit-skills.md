---
description: Audit skill descriptions for token limits and recommend reductions if context would be truncated
---

# Audit Skills Command

## Purpose

Detects if the combined token count of all skill descriptions exceeds Claude Code's context window allocation for skills. When skills are loaded, their descriptions from SKILL.md frontmatter are injected into context. If too many skills exist or descriptions are too verbose, some may be silently truncated. This command identifies the problem and presents a remediation plan.

## Variables

- **TOKEN_LIMIT**: 4000 (estimated max tokens for skill descriptions in context)
- **CHARS_PER_TOKEN**: 4 (approximate characters per token)
- **CHAR_LIMIT**: 16000 (TOKEN_LIMIT * CHARS_PER_TOKEN)

## Workflow

### Step 1: Discover All Skills

**Actions:**
- Scan `~/.claude/skills/*/SKILL.md` for user skills
- Scan `.claude/skills/*/SKILL.md` for project skills (if exists)
- Record each skill name and file path

### Step 2: Extract Descriptions

FOR EACH skill found:
- Read the SKILL.md file
- Parse YAML frontmatter
- Extract the `description` field value
- Calculate character count for that description
- Store: `{ name, path, description, charCount }`

### Step 3: Calculate Totals

**Actions:**
- Sum all description character counts
- Calculate estimated token count (total chars / CHARS_PER_TOKEN)
- Sort skills by description length (descending)

### Step 4: Evaluate Status

IF total characters <= CHAR_LIMIT:
- Report all skills fit within context
- Display summary table with counts
- **EXIT** with success message

IF total characters > CHAR_LIMIT:
- Calculate overage amount
- Identify top contributors to token usage
- **CONTINUE** to Step 5

### Step 5: Enter Plan Mode

**CRITICAL**: Use EnterPlanMode tool to present remediation options

In plan mode, analyze and propose:

1. **Quick Wins** - Skills with verbose descriptions that can be shortened
   - Identify descriptions over 200 characters
   - Suggest condensed alternatives

2. **Removal Candidates** - Skills that may be redundant or rarely used
   - Look for overlapping functionality
   - Identify MCP-based skills that duplicate each other

3. **Priority Ranking** - Order recommendations by impact
   - Calculate tokens saved per recommendation
   - Estimate effort level (low/medium/high)

Present a table showing:
```
| Skill Name | Current Chars | Suggested Chars | Savings | Action |
|------------|---------------|-----------------|---------|--------|
```

## Expected Outputs

### Under Limit

```
✅ Skills Audit Complete

Total Skills: 35
Total Description Characters: 12,450
Estimated Tokens: ~3,112
Context Limit: ~4,000 tokens

Status: All skills fit within context window
```

### Over Limit

```
⚠️  Skills Audit - Action Required

Total Skills: 42
Total Description Characters: 21,800
Estimated Tokens: ~5,450
Context Limit: ~4,000 tokens
Overage: ~1,450 tokens (~5,800 characters)

Entering plan mode to present remediation options...
```

## Error Scenarios

- **No skills found**: Report empty skill directories
- **Malformed SKILL.md**: Skip file, warn user, continue scanning
- **Missing description field**: Count as 0 characters, flag for review

## Examples

<example>
Context: User has 35 skills with reasonable descriptions

User: "/audit-skills"

Result:
✅ Skills Audit Complete
Total Skills: 35
Total Description Characters: 11,200
Estimated Tokens: ~2,800
Status: All skills fit within context window

Top 5 by size:
1. ai-docs (312 chars)
2. mcp-chrome-devtools (298 chars)
3. react-component (245 chars)
4. typescript (231 chars)
5. css (218 chars)
</example>

<example>
Context: User has 50+ skills exceeding limits

User: "/audit-skills"

Result:
⚠️  Skills Audit - Action Required
Overage: ~2,100 tokens

[Enters plan mode with specific recommendations]

Plan includes:
- Shorten 8 verbose descriptions (saves ~800 tokens)
- Consider removing 3 redundant MCP skills (saves ~600 tokens)
- Merge 2 overlapping skills (saves ~400 tokens)
</example>

## Best Practices

- Run this audit after adding new skills
- Keep descriptions under 200 characters when possible
- Focus descriptions on trigger keywords rather than full explanations
- Remove skills you no longer use

## Notes

The 4000 token limit is an estimate based on Claude Code's context allocation for skill loading. Actual limits may vary. This command errs on the side of caution to ensure all your skills are properly loaded into context.

Token estimation uses 4 characters per token as a rough heuristic. Actual tokenization varies by content, but this provides a reasonable approximation for planning purposes.
