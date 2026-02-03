---
description: Create a new skill using the validated template from standards
argument-hint: [prompt]
---

# Create Skill Command

> **META-COMMAND**: This is a skill-creation wizard. Invoke it with a description of the skill you want to create, and it will guide you through building it.
>
> Example: `/skill:new a skill for processing and validating CSV files`
>
> The agent will then gather requirements (name, triggers, tools) and generate the skill directory with SKILL.md.

## Purpose

Creates a new Claude Code skill directory with SKILL.md using the standardized template with built-in validation guidance. This command ensures skills are created with proper formatting, correct directory structure, and in the correct location.

**Key Difference from Commands/Agents**: Skills are MODEL-INVOKED (Claude automatically uses them based on description triggers), while commands are USER-INVOKED (explicit `/command` syntax).

**All skills are created at project-level**: `.claude/skills/`

## Variables

- **prompt**: The description or details of the skill to create. Used to gather skill information including name, description with trigger terms, and optional tool restrictions

## Usage Pattern

```text
/skill:new [skill details...]
```

## Prerequisites

- Template exists at `skill/_template.md` (sibling file in this prompts directory)

## Process Flow

### Step 1: Gather Skill Information

Prompt the user for:

- **Skill name** (lowercase with hyphens only, max 64 chars, no quotes)
- **Description** (brief, includes WHAT it does AND WHEN to use it, trigger terms, **CRITICAL: NO QUOTES AT ALL**, max 1024 chars)
- **allowed-tools** (optional, comma-separated list of tools to restrict to)
- **Core capabilities** (what the skill provides)
- **Trigger conditions** (when Claude should activate this skill)

### Step 2: Determinism Assessment

**Principle**: Lean toward determinism. If an operation CAN be handled by a script, it SHOULD be.

Skills have native support for scripts via their `scripts/` subfolder. Use this for deterministic operations.

**Discovery Questions** (ask when capabilities suggest potential for determinism):
- "Are there operations that should produce identical output given identical input?"
- "Does this skill process data, validate inputs, or transform files?"
- "Will it interact with external APIs or services with specific parameters?"
- "Are there formatting, parsing, or generation steps that benefit from scripts?"

**Deterministic by Default** (create scripts for these):
- Data validation or transformation
- File parsing or generation
- API request construction
- Date/time calculations
- Text processing with regex or structured rules
- Configuration or parameter building
- Any operation where LLM variance is undesirable

**Script Location**: `.claude/skills/[skill-name]/scripts/`

When deterministic scripts are needed:
1. Plan script files during skill creation
2. Create scripts in the `scripts/` subfolder
3. Reference scripts in SKILL.md with relative paths
4. Include execution instructions in the skill's workflow

### Step 3: Determine Target Location

**Target Location**: `.claude/skills/[skill-name]/SKILL.md`

**Important**: Skills require a DIRECTORY containing SKILL.md, not just a single .md file.

### Step 4: Load Template

Read the `skill/_template.md` file (sibling file in this prompts directory).

### Step 5: Create Directory Structure

Skills require at minimum:

```text
[skill-name]/
└── SKILL.md                    # Required - core prompt and instructions
```

Optionally may include:

```text
[skill-name]/
├── SKILL.md                    # Required
├── reference.md                # Optional - supplemental docs
├── examples/                   # Optional - example workflows
│   └── [workflow].md
├── scripts/                    # Optional - helper scripts
│   └── [helper].py
└── templates/                  # Optional - templates/assets
    └── [template].txt
```

### Step 6: Create Directory, SKILL.md, and Scripts

1. Create the skill directory at `.claude/skills/[skill-name]/`
2. If deterministic scripts identified in Step 2:
   - Create `scripts/` subdirectory
   - Write script files (TypeScript, Python, or shell)
3. Create SKILL.md inside the directory using Write tool with:
   - Template structure applied
   - User-provided values substituted
   - Proper frontmatter formatting
   - Script references with relative paths (e.g., `./scripts/helper.ts`)

### Step 7: Confirm Creation

After creation:

- Verify directory and SKILL.md were created successfully
- Display location to user
- Note that skill is model-invoked (Claude auto-activates based on triggers)

## Expected Outputs

### Success

```text
✅ Skill created successfully
📁 Location: .claude/skills/my-skill/SKILL.md
🤖 Invocation: Model-invoked (Claude auto-activates based on triggers)
🔑 Trigger terms: [list of trigger terms from description]
🔧 Scripts: .claude/skills/my-skill/scripts/ (if applicable)
```

### Error

```text
❌ Failed to create skill
Error: [Specific error message]
```

## Error Scenarios

- **Invalid name format**: Remind user to use only lowercase letters, numbers, and hyphens
- **Name too long**: Maximum 64 characters
- **Description has quotes**: Remind user to use no quotes at all
- **Description too long**: Maximum 1024 characters
- **Missing trigger terms**: Description must include WHEN to use, not just WHAT it does
- **Invalid allowed-tools format**: Show correct comma-separated format
- **Directory already exists**: Ask if user wants to overwrite
- **Template not found**: Check commands directory structure

## Examples

<example>
Context: User wants to create a PDF processing skill

User: "/skill:new pdf-processor"

Assistant prompts:

- Name: pdf-processor (from command)
- Description: Extract text from PDFs, fill forms, and merge documents. Use when user needs to work with PDF files, extract document content, fill out forms, or combine multiple PDFs.
- allowed-tools: Read, Write, Bash
- Capabilities: Text extraction, form filling, document merging
- Triggers: "PDF", "extract text", "fill form", "merge documents"

Result: Skill directory created at .claude/skills/pdf-processor/SKILL.md
</example>

<example>
Context: Creating a deployment skill

User: "/skill:new deploy-helper"

Assistant prompts:

- Name: deploy-helper
- Description: Automate deployment to staging and production environments. Use when user mentions deploy, deployment, staging, production, or release.
- allowed-tools: Bash, Read
- Capabilities: Environment configuration, deployment scripts, rollback procedures
- Triggers: "deploy", "staging", "production", "release"

Result: Skill directory created at .claude/skills/deploy-helper/SKILL.md
</example>

<example>
Context: Creating a read-only code analysis skill

User: "Create a skill for analyzing code quality without making changes"

Assistant determines this needs tool restrictions:

- Name: code-analyzer
- Description: Analyze code quality, find patterns, and identify issues without modifying files. Use when user wants code analysis, pattern detection, or quality metrics.
- allowed-tools: Read, Grep, Glob (read-only tools only)
- Capabilities: Pattern detection, quality metrics, dependency analysis
- Triggers: "analyze code", "code quality", "find patterns", "code metrics"

Result: Skill created with restricted tool access for safety
</example>

<example>
Context: Creating a data transformation skill with deterministic scripts

User: "/skill:new csv-processor"

Assistant prompts:

- Name: csv-processor
- Description: Parse, transform, and validate CSV files. Use when user needs to work with CSV data, convert formats, or validate data structure.
- allowed-tools: Read, Write, Bash
- Capabilities: CSV parsing, data validation, format conversion
- Triggers: "CSV", "parse CSV", "convert CSV", "validate data"

Determinism Assessment:
- CSV parsing: YES (deterministic - use script)
- Data validation rules: YES (deterministic - use script)
- Format conversion: YES (deterministic - use script)
- Deciding what transformations to apply: NO (requires LLM judgment)

Created Structure:
```
.claude/skills/csv-processor/
├── SKILL.md
└── scripts/
    ├── parse-csv.ts
    ├── validate-schema.ts
    └── convert-format.ts
```

Script handles: Parsing, validation, format conversion
Skill handles: Understanding user intent, choosing transformations, explaining results
</example>

## Best Practices

- **CRITICAL**: Description field must have NO QUOTES (not double quotes, not single quotes)
- **CRITICAL**: Name must be lowercase with hyphens only (no underscores, no spaces)
- **CRITICAL**: Description must include BOTH what AND when (trigger terms are essential)
- Skills are directories with SKILL.md inside, not single .md files
- Use allowed-tools to restrict capabilities when appropriate (e.g., read-only skills)
- Include clear trigger terms so Claude knows when to activate

## Key Differences from Commands and Agents

| Aspect | Skills | Commands | Agents |
|--------|--------|----------|--------|
| **Invocation** | Model-invoked (automatic) | User-invoked (`/command`) | Model-invoked via Task tool |
| **Structure** | Directory with SKILL.md | Single .md file | Single .md file |
| **Discovery** | Via description triggers | Via `/help` | Via agent descriptions |
| **Complexity** | Complex capabilities | Simple prompts | Specialized tasks |
| **Files** | SKILL.md + scripts/templates | One file only | One file only |

## Related Commands

- `/agent:new`: Create a new agent file
- `/command:new`: Create a new command file

## Notes

This command creates Claude Code skills - modular capabilities that Claude automatically invokes based on trigger terms in the description. Unlike commands (user-invoked with `/`) or agents (spawned for specific tasks), skills are seamlessly integrated and activate when relevant.

The description field is critical for skill discovery. Include:

1. WHAT the skill does (capabilities)
2. WHEN to use it (trigger terms users would mention)

Example good description:
"Extract text from PDFs, fill forms, and merge documents. Use when user needs to work with PDF files, extract document content, fill out forms, or combine multiple PDFs."

Example bad description:
"Handles PDF operations" (too vague, no trigger terms)
