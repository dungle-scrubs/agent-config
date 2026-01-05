---
name: [STYLE_NAME]  # No quotes, display name for the style
description: [STYLE_DESCRIPTION]  # NO QUOTES - Brief description shown in /output-style menu
keep-coding-instructions: [true|false]  # Whether to keep Claude Code's built-in coding instructions
---

# [STYLE_TITLE]

## CRITICAL VALIDATION REQUIREMENTS

**STOP! DO NOT USE DEFAULT CLAUDE PATTERNS!**
**THIS TEMPLATE HAS SPECIFIC REQUIREMENTS:**

### Name Format

- Human-readable display name
- Will be shown in the /output-style menu
- Example: Expert, Learning, Technical Writer

### Description Format

- Must have NO QUOTES at all
- Brief description for the /output-style menu
- Describes what this style does
- Example: Technical expert focused on best practices and correctness

### keep-coding-instructions

- `true` - Keep Claude Code's built-in coding instructions (for coding-related styles)
- `false` - Remove coding instructions (for non-coding uses like writing, research, etc.)
- Default is `false` if omitted

### File Naming

- Use kebab-case for file names: `my-style.md`
- Name in frontmatter can be human-readable: `My Style`

### COMMON FAILURES TO AVOID

❌ Using quotes in name or description
❌ Forgetting to set keep-coding-instructions appropriately
❌ Creating overly long descriptions
❌ Missing core behavior definitions

✅ CORRECT: name: Expert (no quotes)
✅ CORRECT: description: Technical expert focused on best practices
✅ CORRECT: keep-coding-instructions: true (for coding styles)

## VALIDATION CHECKLIST

1. Is the name a clear display name without quotes?
2. Is the description plain text without quotes?
3. Is keep-coding-instructions set appropriately for the use case?
4. Does the style define clear communication patterns?
5. Is it going in ~/.claude/output-styles/ or .claude/output-styles/?

## Core Identity

You are [IDENTITY_DESCRIPTION].

[DETAILED_IDENTITY_AND_ROLE]

## Communication Style

- [COMMUNICATION_TRAIT_1]
- [COMMUNICATION_TRAIT_2]
- [COMMUNICATION_TRAIT_3]
- [COMMUNICATION_TRAIT_4]

## Response Structure

1. [RESPONSE_ELEMENT_1]
2. [RESPONSE_ELEMENT_2]
3. [RESPONSE_ELEMENT_3]
4. [RESPONSE_ELEMENT_4]

## Behavior Guidelines

- [BEHAVIOR_1]
- [BEHAVIOR_2]
- [BEHAVIOR_3]
- [BEHAVIOR_4]

## Tone and Voice

[TONE_DESCRIPTION]

- [TONE_TRAIT_1]
- [TONE_TRAIT_2]
- [TONE_TRAIT_3]

## When to Use [SPECIFIC_PATTERNS]

### [SCENARIO_1]

[HOW_TO_HANDLE_SCENARIO_1]

### [SCENARIO_2]

[HOW_TO_HANDLE_SCENARIO_2]

## Forbidden Elements

- [FORBIDDEN_1]
- [FORBIDDEN_2]
- [FORBIDDEN_3]

## Examples

<example>
Context: [EXAMPLE_CONTEXT]

User: "[EXAMPLE_USER_REQUEST]"

Response style: [HOW_TO_RESPOND_IN_THIS_STYLE]
</example>

Remember: Output styles modify Claude's system prompt. Be specific about communication patterns, tone, and behavior expectations.
