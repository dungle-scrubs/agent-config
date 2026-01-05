---
name: [SKILL_NAME]  # No quotes, lowercase with hyphens ONLY (max 64 chars)
description: [SKILL_DESCRIPTION]  # NO QUOTES - Brief description of what AND when to use (max 1024 chars)
allowed-tools: [TOOL_LIST]  # Optional: comma-separated, no brackets (e.g., Read, Grep, Glob)
---

# [SKILL_TITLE]

## CRITICAL VALIDATION REQUIREMENTS

**STOP! DO NOT USE DEFAULT CLAUDE PATTERNS!**
**THIS TEMPLATE HAS SPECIFIC REQUIREMENTS:**

### Name Format

- Lowercase letters, numbers, hyphens ONLY
- Maximum 64 characters
- NO quotes around the name
- NO underscores or spaces
- Example: pdf-processing, code-reviewer, form-filler

### Description Format (CRITICAL)

- Must have NO QUOTES at all
- Include BOTH what the skill does AND when to use it
- Include trigger terms users would mention
- Maximum 1024 characters
- Example: Extract text from PDFs and fill forms. Use when working with PDF files, document extraction, or form automation.

### allowed-tools Format (Optional)

- Comma-separated list
- NO array brackets
- NO quotes around tool names
- Example: Read, Grep, Glob, Bash, Write
- Omit entirely if no restrictions needed

### Directory Structure

Skills are directories containing at minimum a SKILL.md file:

```text
my-skill/
├── SKILL.md                    # Required - core prompt and instructions
├── reference.md                # Optional - supplemental documentation
├── examples.md                 # Optional - additional examples
├── scripts/
│   └── helper.py              # Optional - executable utilities
└── templates/
    └── template.txt           # Optional - templates and assets
```

### COMMON FAILURES TO AVOID

❌ Using quotes in name or description
❌ Using underscores or uppercase in name
❌ Using array brackets in allowed-tools: [Read, Write]
❌ Creating a single .md file instead of a directory with SKILL.md
❌ Missing trigger terms in description
❌ Description too long (>1024 chars)

✅ CORRECT: name: pdf-processing (no quotes, lowercase-hyphen)
✅ CORRECT: description: Extract PDFs. Use when user mentions PDF files.
✅ CORRECT: allowed-tools: Read, Write, Bash
✅ CORRECT: Directory structure with SKILL.md inside

## VALIDATION CHECKLIST

1. Is the name lowercase with hyphens only (no quotes)?
2. Is the description plain text without quotes?
3. Does the description include WHAT it does AND WHEN to use it?
4. Are trigger terms included in the description?
5. Are allowed-tools comma-separated without brackets (if used)?
6. Is this going in ~/.claude/skills/[name]/ or .claude/skills/[name]/?
7. Is the main file named SKILL.md (not skill.md or Skill.md)?

## When to Use This Skill

This skill should be triggered when:

- [TRIGGER_CONDITION_1]
- [TRIGGER_CONDITION_2]
- [TRIGGER_CONDITION_3]

## Core Capabilities

1. **[CAPABILITY_1_TITLE]**: [CAPABILITY_1_DESCRIPTION]
2. **[CAPABILITY_2_TITLE]**: [CAPABILITY_2_DESCRIPTION]
3. **[CAPABILITY_3_TITLE]**: [CAPABILITY_3_DESCRIPTION]

## Instructions

### [INSTRUCTION_SECTION_1]

[DETAILED_INSTRUCTIONS]

**Steps:**

- [STEP_1]
- [STEP_2]
- [STEP_3]

### [INSTRUCTION_SECTION_2]

[DETAILED_INSTRUCTIONS]

**Steps:**

- [STEP_1]
- [STEP_2]
- [STEP_3]

## Available Tools/Resources

### [TOOL_CATEGORY_1] ([COUNT] tools)

- **[TOOL_1_NAME]** - [TOOL_1_DESCRIPTION]
- **[TOOL_2_NAME]** - [TOOL_2_DESCRIPTION]
- **[TOOL_3_NAME]** - [TOOL_3_DESCRIPTION]

### [TOOL_CATEGORY_2] ([COUNT] tools)

- **[TOOL_1_NAME]** - [TOOL_1_DESCRIPTION]
- **[TOOL_2_NAME]** - [TOOL_2_DESCRIPTION]

## Usage

### Quick Start

```bash
[QUICK_START_COMMAND_OR_EXAMPLE]
```

### Common Patterns

```bash
[COMMON_USAGE_PATTERN_1]
```

```bash
[COMMON_USAGE_PATTERN_2]
```

## Common Workflows

### [WORKFLOW_1_NAME] Workflow

1. **[STEP_1_NAME]** - [STEP_1_DESCRIPTION]
2. **[STEP_2_NAME]** - [STEP_2_DESCRIPTION]
3. **[STEP_3_NAME]** - [STEP_3_DESCRIPTION]

**Example**: See `examples/[EXAMPLE_FILE].md` for detailed workflows

### [WORKFLOW_2_NAME] Workflow

1. **[STEP_1_NAME]** - [STEP_1_DESCRIPTION]
2. **[STEP_2_NAME]** - [STEP_2_DESCRIPTION]
3. **[STEP_3_NAME]** - [STEP_3_DESCRIPTION]

## Configuration

[CONFIGURATION_DESCRIPTION]

```bash
[CONFIGURATION_EXAMPLE]
```

## Error Handling

- **[ERROR_SCENARIO_1]**: [ERROR_RESPONSE_1]
- **[ERROR_SCENARIO_2]**: [ERROR_RESPONSE_2]
- **[ERROR_SCENARIO_3]**: [ERROR_RESPONSE_3]

## Troubleshooting

### [ISSUE_1]

```bash
[TROUBLESHOOTING_STEPS_1]
```

### [ISSUE_2]

```bash
[TROUBLESHOOTING_STEPS_2]
```

## Dependencies

### Required

- [DEPENDENCY_1] - [DEPENDENCY_1_DESCRIPTION]
- [DEPENDENCY_2] - [DEPENDENCY_2_DESCRIPTION]

### Optional

- [OPTIONAL_DEPENDENCY_1] - [OPTIONAL_DEPENDENCY_1_DESCRIPTION]

## Examples

<example>
Context: [EXAMPLE_CONTEXT]

User: "[EXAMPLE_USER_REQUEST]"

Result: [EXAMPLE_RESULT]
</example>

## Notes

- [IMPORTANT_NOTE_1]
- [IMPORTANT_NOTE_2]
- [IMPORTANT_NOTE_3]

Remember: Skills are MODEL-INVOKED, meaning Claude automatically decides when to use them based on the description's trigger terms. Make descriptions clear and specific!
