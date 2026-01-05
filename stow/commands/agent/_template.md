---
name: [AGENT_NAME]  # No quotes, kebab-case ONLY
description: [WHEN_TO_USE]  # NO QUOTES - plain text only
tools: [TOOL_LIST]  # No brackets, no quotes, comma-separated
model: [MODEL_CHOICE]  # ONLY: haiku, sonnet, or opus
color: [COLOR_CHOICE]  # yellow for haiku, blue for sonnet, purple for opus
---

# [AGENT_TITLE] Agent

## CRITICAL VALIDATION REQUIREMENTS

**STOP! DO NOT USE DEFAULT CLAUDE PATTERNS!**
**THIS TEMPLATE HAS SPECIFIC REQUIREMENTS:**

### Model Names - ONLY THESE THREE STRINGS
- `haiku` (NOT claude-3-5-haiku or any variant)
- `sonnet` (NOT claude-3-5-sonnet-20241022)  
- `opus` (NOT claude-3-opus or any variant)

### Tools Format
- Comma-separated list
- NO array brackets [Read, Write]
- NO quotes around tool names
- Example: Read, Write, Edit, Bash, Grep

### Name Format
- kebab-case ONLY
- NO quotes around the name
- NO underscores or spaces
- Example: file-creator, test-runner, code-reviewer

### COMMON FAILURES TO AVOID
❌ Using full model names like "claude-3-5-sonnet-20241022"
❌ Using array brackets in tools: [Read, Write]
❌ Using single quotes in YAML
❌ Creating files in wrong directories
❌ Ignoring the template structure

✅ CORRECT: model: haiku
✅ CORRECT: tools: Read, Write, Edit
✅ CORRECT: name: kebab-case-name (no quotes)
✅ CORRECT: description: Clear description (no quotes)

## VALIDATION CHECKLIST
1. Is the model one of: haiku, sonnet, opus? (NOTHING ELSE)
2. Are tools comma-separated without brackets?
3. Is the name in kebab-case without quotes?
4. Is the description plain text without quotes?

## Core Purpose

[CORE_PURPOSE_DESCRIPTION]

## When to Use

This agent should be triggered when:
- [TRIGGER_CONDITION_1]
- [TRIGGER_CONDITION_2]
- [TRIGGER_CONDITION_3]

## Core Responsibilities

1. **[RESPONSIBILITY_1_TITLE]**: [RESPONSIBILITY_1_DESCRIPTION]
2. **[RESPONSIBILITY_2_TITLE]**: [RESPONSIBILITY_2_DESCRIPTION]
3. **[RESPONSIBILITY_3_TITLE]**: [RESPONSIBILITY_3_DESCRIPTION]

## Operational Workflow

### Phase 1: [PHASE_1_NAME]

[PHASE_1_DESCRIPTION]

**Actions:**
- [ACTION_1]
- [ACTION_2]
- [ACTION_3]

### Phase 2: [PHASE_2_NAME]

[PHASE_2_DESCRIPTION]

**Actions:**
- [ACTION_1]
- [ACTION_2]
- [ACTION_3]

### Phase 3: [PHASE_3_NAME]

[PHASE_3_DESCRIPTION]

**Actions:**
- [ACTION_1]
- [ACTION_2]
- [ACTION_3]

## Success Criteria

- [CRITERION_1]
- [CRITERION_2]
- [CRITERION_3]

## Error Handling

- **[ERROR_SCENARIO_1]**: [ERROR_RESPONSE_1]
- **[ERROR_SCENARIO_2]**: [ERROR_RESPONSE_2]
- **[ERROR_SCENARIO_3]**: [ERROR_RESPONSE_3]

## Output Format

### Success Response

```text
[SUCCESS_OUTPUT_FORMAT]
```

### Error Response

```text
[ERROR_OUTPUT_FORMAT]
```

## Constraints

- [CONSTRAINT_1]
- [CONSTRAINT_2]
- [CONSTRAINT_3]

## Examples

<example>
[EXAMPLE_SCENARIO]

[EXAMPLE_INPUT]

[EXAMPLE_OUTPUT]
</example>

Remember: [KEY_REMINDER]
