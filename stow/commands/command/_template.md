---
description: COMMAND_DESCRIPTION  # NO QUOTES AT ALL
---

# [COMMAND_TITLE] Command

## CRITICAL FORMATTING REQUIREMENTS

### Description Format
- Must have NO QUOTES at all
- Not double quotes, not single quotes, not backticks
- Example: description: Create a new agent file

### Path References
- Use @ prefix for file paths in commands
- Use ~/.claude/ for global files
- Project files use ./.claude/ prefix

### Date Format
- Always use YYYY-MM-DD format
- Example: 2025-01-14

## Purpose

[DETAILED_PURPOSE_DESCRIPTION]

## Usage Pattern

```text
@~/.claude/commands/[COMMAND_NAME].md
```

Alternative for project-specific:
```text
@./.claude/commands/[COMMAND_NAME].md
```

## Prerequisites

- [PREREQUISITE_1]
- [PREREQUISITE_2]
- [PREREQUISITE_3]

## Process Flow

### Step 1: [STEP_1_NAME]

[STEP_1_DESCRIPTION]

**Actions:**
- [ACTION_1]
- [ACTION_2]
- [ACTION_3]

### Step 2: [STEP_2_NAME]

[STEP_2_DESCRIPTION]

**Actions:**
- [ACTION_1]
- [ACTION_2]
- [ACTION_3]

### Step 3: [STEP_3_NAME]

[STEP_3_DESCRIPTION]

**Actions:**
- [ACTION_1]
- [ACTION_2]
- [ACTION_3]

## Expected Outputs

### [OUTPUT_TYPE_1]

```text
[OUTPUT_FORMAT_1]
```

### [OUTPUT_TYPE_2]

```text
[OUTPUT_FORMAT_2]
```

## Error Scenarios

- **[ERROR_SCENARIO_1]**: [ERROR_HANDLING_1]
- **[ERROR_SCENARIO_2]**: [ERROR_HANDLING_2]
- **[ERROR_SCENARIO_3]**: [ERROR_HANDLING_3]

## Examples

<example>
Context: [EXAMPLE_CONTEXT]

User: "[EXAMPLE_USER_REQUEST]"

Result: [EXAMPLE_RESULT]
</example>

## Best Practices

- [BEST_PRACTICE_1]
- [BEST_PRACTICE_2]
- [BEST_PRACTICE_3]

## Related Commands

- `[RELATED_COMMAND_1]`: [RELATION_DESCRIPTION_1]
- `[RELATED_COMMAND_2]`: [RELATION_DESCRIPTION_2]

## Notes

[ADDITIONAL_NOTES_OR_WARNINGS]
