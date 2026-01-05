---
description: Create a new agent using the validated template from standards
argument-hint: [prompt]
---

# Create Agent Command

## Purpose

Creates a new Claude Code agent file using the standardized template with built-in validation guidance. This command ensures agents are created with proper formatting and in the correct location.

**All agents are created at project-level**: `.claude/agents/`

## Variables

- **prompt**: The description or details of the agent to create. Used to gather agent information including name, model choice, and required tools

## Usage Pattern

```text
/agent:new [agent details...]
```

## Prerequisites

- Template exists at `~/.claude/commands/agent/_template.md`

## Process Flow

### Step 1: Gather Agent Information

Prompt the user for:

- **Agent name** (kebab-case, no quotes)
- **Description** (brief, for YAML header - **CRITICAL: NO QUOTES AT ALL**, not double quotes, not single quotes)
- **Model choice** (haiku, sonnet, or opus)
- **Required tools** (comma-separated list)

### Step 2: Determinism Assessment

**Principle**: Lean toward determinism. If an operation CAN be handled by a script, it SHOULD be.

**Discovery Questions** (ask when purpose suggests potential for determinism):
- "Are there operations that should produce identical output given identical input?"
- "Does this agent process data, validate inputs, or transform files?"
- "Will it interact with external APIs or services with specific parameters?"
- "Are there formatting, parsing, or generation steps that benefit from scripts?"

**Deterministic by Default** (create scripts for these):
- Data validation or transformation
- File parsing or generation
- API request construction
- Date/time calculations
- Text processing with regex or structured rules
- Configuration or parameter building

**Script Location**: `.claude/.scripts/agents/[agent-name]/`

When deterministic scripts are needed:
1. Create the `.scripts/agents/[agent-name]/` directory
2. Generate appropriate scripts (TypeScript, Python, or shell)
3. Reference scripts in the agent with full paths
4. Include execution instructions in the agent's workflow

### Step 3: Determine Target Location

**Target Location**: `.claude/agents/[agent-name].md`

### Step 4: Load Template

Reference the enhanced template from:

```text
~/.claude/commands/agent/_template.md
```

### Step 5: Create Agent and Scripts

Create the agent file and any deterministic scripts identified in Step 2.

**Agent Location**: `.claude/agents/[agent-name].md`
**Scripts Location**: `.claude/.scripts/agents/[agent-name]/`

**If scripts are needed**:
1. Create `.claude/.scripts/agents/[agent-name]/` directory via Bash
2. Write scripts using Write tool
3. Reference scripts in agent with paths like:
   - Project-level: `./.claude/.scripts/agents/[name]/script.ts`
   - User-level: `~/.claude/.scripts/agents/[name]/script.ts`

**Agent file creation**:
- Template structure applied
- User-provided values substituted
- Proper frontmatter formatting
- Script references included in workflow

### Step 6: Confirm Creation

After file creation:

- Verify file was created successfully
- Display location to user

## Expected Outputs

### Success

```text
✅ Agent created successfully
📁 Location: .claude/agents/my-agent.md
🔧 Scripts: .claude/.scripts/agents/my-agent/ (if applicable)
```

### Error

```text
❌ Failed to create agent
Error: [Specific error message]
```

## Error Scenarios

- **Invalid model name**: Remind user to use only haiku, sonnet, or opus
- **Invalid tools format**: Show correct comma-separated format
- **File already exists**: Ask if user wants to overwrite
- **Template not found**: Check commands directory structure

## Examples

<example>
Context: User wants to create a code review agent

User: "/agent:new code-reviewer"

Assistant prompts:

- Name: code-reviewer (from command)
- Description: Reviews code for quality and security issues
- Model: sonnet
- Tools: Read, Grep, Bash

Result: Agent file created at .claude/agents/code-reviewer.md
</example>

<example>
Context: Creating a test runner agent

User: "/agent:new test-runner"

Assistant prompts:

- Name: test-runner
- Description: Executes and validates test suites
- Model: haiku
- Tools: Bash, Read

Result: Agent file created at .claude/agents/test-runner.md
</example>

<example>
Context: Creating an API client agent with deterministic request building

User: "/agent:new api-fetcher"

Assistant prompts:

- Name: api-fetcher
- Description: Fetches data from REST APIs with proper authentication and error handling
- Model: sonnet
- Tools: Bash, Read, Write

Determinism Assessment:
- API URL construction: YES (deterministic - use script)
- Auth header generation: YES (deterministic - use script)
- Response parsing: YES (deterministic - use script)
- Error interpretation: NO (requires LLM judgment)

Created Files:
- .claude/agents/api-fetcher.md
- .claude/.scripts/agents/api-fetcher/build-request.ts
- .claude/.scripts/agents/api-fetcher/parse-response.ts

Script handles: URL construction, header building, JSON parsing
Agent handles: Deciding what to fetch, interpreting results, error recovery decisions
</example>

## Best Practices

- **CRITICAL**: Description field must have NO QUOTES (not double quotes, not single quotes)
- Always reference the template validation requirements in `~/.claude/commands/agent/_template.md`
- Ensure model names are exactly haiku, sonnet, or opus
- Use comma-separated tools without brackets
- Follow kebab-case naming convention

## Related Commands

- `/command:new`: Create a new command file
- `/skill:new`: Create a new skill directory

## Notes

This command acts as a user-friendly wrapper for creating agents with proper validation and structure. It ensures consistency and reduces common formatting errors.
