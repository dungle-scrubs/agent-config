---
description: Create a new command using the validated template from standards
argument-hint: [prompt]
---

# Create Command

## Purpose

Creates a new Claude Code command file with intelligent prompt classification and structure. Uses interactive discovery to determine the appropriate prompt level (L1-L7) and applies corresponding structural patterns. Ensures commands are created with optimal complexity, proper formatting, and REQUIRED frontmatter.

**All commands are created at project-level**: `.claude/commands/`

## Before You Start - Required Knowledge

You MUST understand:

1. **Commands require frontmatter** (see template)
2. **Template is mandatory**, not optional
3. **Classification adds to template**, doesn't replace it
4. **Description field has NO QUOTES**, not double, not single

If any of these are unclear, read the template first:
`~/.claude/commands/command/_template.md`

## Variables

- **prompt**: The description or details of the command to create. Used during interactive discovery to determine prompt level classification and populate command content

## Usage Pattern

```text
/command:new [command details...]
```

## Prerequisites

- Prompt classification system from `~/.claude/commands/command/_prompt-levels.md`
- Structural patterns from `~/.claude/commands/command/_prompt-standards.md`
- Template exists at `~/.claude/commands/command/_template.md`

## Process Flow

### Step 1: Interactive Prompt Classification

**CRITICAL**: Conduct discovery dialogue to determine prompt level and structure needs.

**Discovery Questions** (ask these systematically):

1. **Task Nature**: "Describe what this command should accomplish in 1-2 sentences"
2. **Complexity Indicators**:
   - "Is this a simple one-shot task or does it need multiple coordinated steps?"
   - "Will it need conditional logic (if/then) or loops (for each)?"
   - "Does it coordinate multiple agents or tools?"
   - "Will it need to accept other prompts as input?"
   - "Should it generate other prompts dynamically?"
   - "Does it need to learn and improve over time?"

3. **Input Requirements**:
   - "What inputs/arguments does it need?"
   - "Are these static values or dynamic user inputs?"

4. **Control Flow Needs**:
   - "Are there decision points where it might take different paths?"
   - "Does it need to repeat actions or iterate over collections?"

5. **Deterministic Behavior** (lean toward YES when possible):
   - "Are there operations that should produce identical output given identical input?"
   - "Does this involve data transformations, validation, or formatting?"
   - "Will it fetch external data that needs freshness guarantees (e.g., web searches with date filtering)?"
   - "Are there file operations, parsing, or generation steps that benefit from scripts?"

**Classification Logic** (map responses to levels):

- **L1 (Basic)**: Simple, single-purpose, no branching
- **L2 (Workflow)**: Sequential steps, linear execution
- **L3 (Control Flow)**: IF/THEN, loops, conditions
- **L4 (Delegate)**: Multi-agent coordination
- **L5 (Higher Order)**: Accepts prompts as input
- **L6 (Template Metaprompt)**: Generates prompts
- **L7 (Self-Improving)**: Learns/adapts

### Step 2: Determinism Assessment

**Principle**: Lean toward determinism. If an operation CAN be handled by a script, it SHOULD be.

**Deterministic by Default** (create scripts for these):
- Web searches requiring date/freshness filters (e.g., `--after:2025-01-01`)
- File parsing, transformation, or generation
- Data validation or formatting
- API calls with specific parameters
- Text processing with regex or structured rules
- Any operation where LLM variance is undesirable

**Ask User When Unclear**:
- Operations mixing deterministic and creative aspects
- Complex decision trees that might benefit from either approach
- Performance-sensitive operations (scripts are faster)

**Script Location**: `.claude/.scripts/commands/[command-name]/`

When deterministic scripts are needed:
1. Create the `.scripts/commands/[command-name]/` directory
2. Generate appropriate scripts (TypeScript, Python, or shell)
3. Reference scripts in the command with full paths
4. Include execution instructions in the command's workflow

### Step 3: Complexity-Based Workflow Selection

Based on classification level from Step 1:

**IF L1, L2, or L3**: Continue to Step 4 (standard workflow)

**IF L4, L5, L6, or L7**: Skip to Step 4A (multi-agent workflow)

---

## Standard Path (L1-L3)

### Step 4: Load Command Template

**CRITICAL**: Load the mandatory command template BEFORE gathering information

```text
Read template from: ~/.claude/commands/command/_template.md
```

This template provides:

- Required frontmatter structure
- Base sections that ALL commands must have
- Formatting requirements

### Step 5: Gather Command Information

Based on classification, prompt for:

- **Command name** (kebab-case for file name)
- **Description** (brief, for YAML header - **CRITICAL: NO QUOTES AT ALL**)
- **Command purpose** (detailed explanation)
- **Required sections** (based on prompt level determined above)
- **Variables needed** (if L3)

### Step 6: Apply Structural Patterns

Based on prompt level classification from Step 1, apply appropriate sections from `~/.claude/commands/command/_prompt-standards.md`:

**L1 (Basic Prompt)**:

```yaml
sections: [Purpose, Instructions]
metadata: description, argument-hint (if needed)
```

**L2 (Workflow Prompt)**:

```yaml
sections: [Purpose, Workflow, Success Criteria]
metadata: description, argument-hint, allowed-tools
control_flow: Sequential steps only
```

**L3 (Control Flow Prompt)**:

```yaml
sections: [Purpose, Variables, Workflow, Instructions]
metadata: description, argument-hint, allowed-tools
control_flow: IF/THEN/ELSE, FOR EACH, WHILE loops
importance_patterns: UPPERCASE, **bold**, *italic*
```

### Step 7: Generate Command Content

Create the command content based on classification:

**Variables Section** (L3):

- Include positional arguments (`$1`, `$2`, `$ARGUMENTS`)
- Add static variables if needed
- Reference `argument-hint` in metadata

**Workflow Section** (L2+):

- Use control flow syntax for L3: `IF condition:`, `FOR EACH item:`
- Include named loop blocks `<block-name>` for complex iterations
- Add success criteria per step

**Instructions Section** (most levels):

- Apply importance patterns: **UPPERCASE**, **bold**, *italic*
- Include technology preferences and constraints
- Add formatting guidelines

### Step 8: Create Command and Scripts

Create the command file and any deterministic scripts identified in Step 2.

**Command Location**: `.claude/commands/[command-name].md`
**Scripts Location**: `.claude/.scripts/commands/[command-name]/`

**If scripts are needed**:
1. Create `.claude/.scripts/commands/[command-name]/` directory via Bash
2. Write scripts using Write tool
3. Reference scripts in command with paths like:
   - Project-level: `./.claude/.scripts/commands/[name]/script.ts`
   - User-level: `~/.claude/.scripts/commands/[name]/script.ts`

### Step 9: Confirm Creation

After file creation:

- Verify file was created successfully
- Display location to user
- Provide usage example

---

## L4+ Path: Multi-Agent Workflow

For complex commands (L4-L7), use parallel subagents to gather context and design architecture.

### Step 4A: Parallel Exploration Phase

Launch TWO exploration agents in parallel using Task tool (subagent_type: Explore):

**Agent 1 - Pattern Explorer**:

- Search `.claude/commands/` for similar L4+ commands
- Extract structural patterns, workflow designs, agent coordination approaches
- Output: List of similar commands with their patterns

**Agent 2 - Reference Explorer**:

- Read `~/.claude/commands/command/_prompt-standards.md`
- Read `~/.claude/commands/command/_prompt-levels.md`
- Extract level-specific requirements and best practices
- Output: Required sections, control flow standards, agent coordination guidance

### Step 4B: Architecture Planning Phase

Launch ONE planning agent (subagent_type: Plan) with combined exploration results:

- Design complete command architecture
- Define sections, variables, workflow steps, agent configurations
- Output: Complete command architecture specification

### Step 4C: Synthesis and Creation

1. Parse architecture from Step 4B
2. Generate command markdown content following template structure
3. Apply level-specific patterns:

**L4 (Delegate Prompt)**:

```yaml
sections: [Purpose, Variables, Workflow, Agent Configuration]
metadata: description, allowed-tools
control_flow: Agent coordination, Task delegation
agent_config: Model, tools, specialized agents
```

**L5 (Higher Order Prompt)**:

```yaml
sections: [Purpose, Variables, Workflow, Instructions]
metadata: description, argument-hint
input_handling: Prompt composition, Dynamic execution
```

**L6 (Template Metaprompt)**:

```yaml
sections: [Purpose, Variables, Template, Workflow]
metadata: description, argument-hint
template_required: true
generation_rules: Pattern matching, Dynamic creation
```

**L7 (Self-Improving Prompt)**:

```yaml
sections: [Purpose, Variables, Workflow, Learning Rules]
metadata: description, allowed-tools
learning_systems: Feedback processing, Self-modification
```

4. Create deterministic scripts in `.claude/.scripts/commands/[name]/` if identified in Step 2
5. Create command file at `.claude/commands/[name].md` using Write tool
6. Display success message with usage example and script locations

---

## Expected Outputs

### Success

```text
✅ Command created successfully
📊 Level: L3 (Control Flow Prompt)
📁 Location: .claude/commands/my-command.md
📝 Usage: /my-command
🏗️ Structure: Purpose, Variables, Workflow, Instructions
🔧 Scripts: .claude/.scripts/commands/my-command/ (if applicable)
```

### Error

```text
❌ Failed to create command
Error: [Specific error message]
📋 Classification: [Completed level if applicable]
```

## Error Scenarios

- **Invalid description format**: Remind user to use no quotes
- **File already exists**: Ask if user wants to overwrite
- **Classification incomplete**: Resume from last completed discovery question
- **Invalid prompt level**: Re-run classification with additional clarification
- **Template not found**: Check commands directory structure
- **Invalid path**: Ensure directory exists

## Examples

<example>
Context: Creating a database migration command with conditional logic

User: "/command:new run-migrations"

Discovery Process:

1. Task Nature: "Run database migrations with rollback capability if needed"
2. Complexity: Needs conditional logic (rollback), multiple steps, no agent coordination
3. Inputs: Migration direction (up/down), target version (optional)
4. Control Flow: IF migration fails THEN rollback, FOR EACH pending migration

Classification: L3 (Control Flow Prompt)
Structure: Purpose, Variables, Workflow, Instructions
Location: .claude/commands/run-migrations.md
</example>

<example>
Context: Simple file cleanup command

User: "/command:new cleanup-temp"

Discovery Process:

1. Task Nature: "Delete temporary files and build artifacts"
2. Complexity: Simple sequential steps, no branching needed
3. Inputs: None (uses predefined paths)
4. Control Flow: Linear execution only

Classification: L2 (Workflow Prompt)
Structure: Purpose, Workflow, Success Criteria
Location: .claude/commands/cleanup-temp.md
</example>

<example>
Context: Multi-agent code review orchestrator

User: "/command:new code-review-orchestrator"

Discovery Process:

1. Task Nature: "Orchestrate security, performance, and quality review agents"
2. Complexity: Multi-agent coordination, result aggregation
3. Inputs: File paths, review types
4. Control Flow: Parallel agent execution, result synthesis

Classification: L4 (Delegate Prompt)

L4+ Workflow Triggered:

- Pattern Explorer finds similar delegate commands
- Reference Explorer extracts L4 requirements
- Plan agent designs agent coordination architecture

Structure: Purpose, Variables, Workflow, Agent Configuration
Location: .claude/commands/code-review-orchestrator.md
</example>

<example>
Context: Web research command with deterministic freshness requirements

User: "/command:new research-topic"

Discovery Process:

1. Task Nature: "Search for recent information on a topic and summarize findings"
2. Complexity: Sequential steps, some conditional logic for source validation
3. Inputs: Topic string, optional date range
4. Control Flow: Search → Filter → Summarize
5. Determinism: YES - date filtering should be deterministic, not LLM-generated

Classification: L3 (Control Flow Prompt)
Determinism: Script for date parameter generation and URL construction

Created Files:
- .claude/commands/research-topic.md
- .claude/.scripts/commands/research-topic/build-search-query.ts

Script handles: Current date calculation, date range formatting, search URL construction
Command handles: Executing search, evaluating results, synthesizing summary
</example>

## Best Practices

- **CRITICAL**: Description field must have NO QUOTES at all (not double quotes, not single quotes)
- Follow kebab-case naming for file names
- Use @ prefix when referencing file paths
- Keep descriptions concise but clear
- Use YYYY-MM-DD format for dates

## Related Commands

- `/agent:new`: Create a new agent file
- `/skill:new`: Create a new skill directory

## Notes

This command uses intelligent prompt classification to determine the optimal structure for new commands. For simple commands (L1-L3), it follows a standard workflow. For complex commands (L4+), it spawns parallel subagents to gather context and design architecture before creation.

Key innovation: L4+ commands benefit from multi-agent exploration and planning, ensuring they're well-structured for agent coordination tasks.
