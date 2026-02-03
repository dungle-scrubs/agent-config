# Prompt Standards and Creation Guide

This document defines comprehensive standards and strategies for creating effective agentic prompts.

> For a detailed breakdown of prompt complexity levels, see `command/_prompt-levels.md` (sibling file)

## Core Principle: Use Only What's Needed

**IMPORTANT**: The goal is NOT to include all sections in every prompt. Only use sections that directly contribute to the task's success. A simple task might only need a Purpose and Workflow. Complex tasks might require multiple sections for clarity.

## 1. Prompt Sections (Structural Components)

These `##` header-level sections form the building blocks of prompts. **Choose only the sections that add value**:

### Title

- H1 header with special purple theming
- Defines the prompt's identity

### Metadata

- YAML frontmatter configuration
- Example:

```yaml
description: Build according to plan
argument-hint: [path-to-plan]
allowed-tools: Read, Write, Bash
mcp-servers: postgres, filesystem, shadcn-ui-server
```

- **MCP Servers**: Can be specified here or in a dedicated section

### Purpose

- High-level description of prompt function
- Answers: "What are we doing?"
- Alternative section names: Build, Task, Objective, Goal

### Variables

- **Dynamic Variables**: Runtime input parameters that change with each invocation
  - **Positional Arguments**:
    - `$1`, `$2`, `$3`, etc. - Individual positional arguments
    - `$ARGUMENTS` or `$*` - All arguments as a single string
    - `$#` - Number of arguments passed
    - Invocation: `/command "first arg" "second arg" third`
      - `$1` = "first arg"
      - `$2` = "second arg"  
      - `$3` = "third"
      - `$ARGUMENTS` = "first arg second arg third"
  - Paired with frontmatter `argument-hint` for user guidance
  - Examples:

    ```yaml
    # Single argument
    argument-hint: [path-to-plan]
    ```

    ```markdown
    PATH_TO_PLAN: $ARGUMENTS
    ```

    ```yaml
    # Multiple positional arguments
    argument-hint: [source-file] [destination-file]
    ```

    ```markdown
    SOURCE: $1
    DEST: $2
    ```

    ```yaml
    # Optional arguments with defaults
    argument-hint: [component-name] [optional-directory]
    ```

    ```markdown
    COMPONENT_NAME: $1
    OUTPUT_DIR: ${2:-./components}  # Defaults to ./components if not provided
    ```

    ```yaml
    # Variadic arguments
    argument-hint: [command] [...files]
    ```

    ```markdown
    COMMAND: $1
    FILES: ${@:2}  # All arguments from position 2 onward
    NUM_FILES: $#  # Total argument count
    ```

- **Static Variables**: Hardcoded paths and constants
  - Fixed values that don't change between runs
  - Example:

    ```markdown
    STANDARDS_DIR: `~/.claude/standards`
    TEMPLATE_PATH: `./templates/component.tsx`
    ```

### Workflow (Orchestrator - Most Important)

- **The core orchestrator that drives prompt execution**
- **Exact steps that MUST be taken in sequence**
- Step-by-step instructions executed in order
- Maps directly to Claude Code's to-do feature
- **This is where the actual work happens** - all other sections support this
- **Control Flow Elements**:
  - **Conditions**: `if/then/else` branching logic
  - **Loops**: `for each`, `while`, iteration over collections
  - **Named Loop Blocks**: Use XML-style tags for complex iterations
  - **Early Returns**: Exit conditions and guard clauses
  - Success criteria per step
  - Tool invocations
  - Progress tracking
  - Error handling
- Examples:

  ```markdown
  ## Workflow
  1. Read the plan file at PATH_TO_PLAN
     - If file doesn't exist: RETURN with error message
     - Success: File exists and is valid markdown
  
  2. Parse each task into actionable items
     - If no tasks found: RETURN "No tasks to process"
     - Success: All tasks have clear objectives
  
  3. FOR EACH task in tasks:
     - IF task.type == "critical":
       - Execute with high priority
       - Validate requirements strictly
     - ELSE:
       - Execute standard implementation
     - Verify success with tests
     - If tests fail: LOG error and CONTINUE to next task
     - Success: Tests pass, no linting errors
  
  4. WHILE unresolved_issues exist:
     - Attempt resolution
     - If max_attempts reached: BREAK
  
  5. Generate final report
     - Success: Report saved to ./reports/
  ```

  **Named Loop Block Pattern** (from @prompts/create-image.md):
  
  ```markdown
  ## Workflow
  - IMPORTANT: Generate NUMBER_OF_IMAGES following the image-loop below
  
  <image-loop>
    - Use mcp__replicate__create_models_predictions with MODEL
    - Pass image prompt as input
    - Wait for completion by polling
    - Save prompt to: IMAGE_OUTPUT_DIR/<date>/prompt_<name>.txt
    - Download image: IMAGE_OUTPUT_DIR/<date>/image_<name>.jpg
  </image-loop>
  
  - After all images generated, open output directory
  ```
  
  Named blocks provide clear boundaries for complex iterations and can be referenced by name in instructions.

### Instructions

- **Non-sequential guidelines, conventions, and constraints**
- Rules that apply throughout the entire workflow execution
- Technology preferences and best practices
- Examples:

  ```markdown
  ## Instructions
  - **ALWAYS** use `pnpm install` instead of `npm install`
  - **ALWAYS** use `useMeasure` from 'ahooks' when measuring dimensions of React components
  - **NEVER** commit directly to main branch
  - Prefer functional components over class components
  - All API calls must include error handling
  - Use kebab-case for file naming
  ```

### Relevant Files

- File references needed for execution

### MCP Servers (Optional Section)

- Specifies Model Context Protocol servers required for the task
- Alternative to including in Metadata
- Examples:

  ```markdown
  ## MCP Servers
  - **postgres**: Database queries and operations
  - **filesystem**: File system operations beyond standard tools
  - **shadcn-ui-server**: Component installation and documentation
  - **zen**: Advanced AI reasoning and consensus building
  ```

- Use when:
  - Task requires specialized server capabilities
  - Multiple servers need coordination
  - Server selection is critical to task success

### Codebase Structure

- Directory layout documentation ("context map")
- Pattern for providing structural awareness without reading files:

```markdown
## Codebase Structure

Take note of these files, but do not read them.

```text
apps/prompt_tier_list/
├── README.md                      # Project documentation
├── package.json                   # Dependencies and scripts
├── src/
│   ├── App.vue                   # Main application entry
│   ├── components/
│   │   ├── TierGrid.vue          # 5x5 grid system
│   │   └── GridCell.vue          # Individual grid cells
│   └── assets/
│       └── global.css            # Theme styling

```

### Expertise

- Domain knowledge and accumulated patterns

### Template

- Reusable structural patterns

### Examples

- Concrete usage demonstrations

### Success Criteria

- List of criteria that must be met for successful execution

### Report

- Output formatting specifications
- Examples: json, yaml, markdown, etc.

## 2. The 7 Prompt Levels (Complexity & Usefulness)

A categorization of prompts by their complexity and capabilities:

1. **High Level** – Basic reusable prompts
2. **Workflow** – Sequential step-by-step execution
3. **Control Flow** – Conditional logic and loops
4. **Delegate** – Multi-agent coordination
5. **Higher Order** – Accepts other prompts as input
6. **Template Metaprompt** – Generates new prompts dynamically
7. **Self Improving** – Evolves based on usage and feedback

> See `command/_prompt-levels.md` (sibling file) for detailed descriptions of each level

## 3. Prompt Format Types

Different structural patterns for organizing prompts:

- **Level 1 - Basic Prompt**: Simple task-focused instructions
- **Level 2 - Workflow Prompt**: Sequential steps with sections
- **Level 3 - Expert Prompt**: Domain expertise integration
- **Level 4 - Template Prompt**: Reusable component patterns
- **Level 5 - Meta Prompt**: Self-modifying structures
- **Level 6 - Template Metaprompt**: Creates new prompts in specific dynamic formats
  - Requires: Template section
  - Examples: `.claude/commands/t_metaprompt_workflow.md`, `.claude/commands/plan_vite_vue.md`
- **Level 7 - Quantum Prompt**: Parallel execution branches

## 4. Writing Guidelines

### Control Flow Syntax

Standard patterns for expressing logic in prompts:

#### Conditionals

- **IF/THEN/ELSE**: `IF condition: action`
- **Guard Clauses**: `If not found: RETURN with error`
- **Nested Conditions**: Indent for clarity

  ```markdown
  IF file exists:
    IF file is valid:
      Process file
    ELSE:
      RETURN "Invalid file format"
  ```

#### Loops

- **FOR EACH**: `FOR EACH item in collection:`
- **WHILE**: `WHILE condition exists:`
- **Loop Control**:
  - `CONTINUE` - Skip to next iteration
  - `BREAK` - Exit loop early
  - `RETURN` - Exit entire workflow
  
#### Named Blocks

- **XML-style tags** for referenceable sections:

  ```markdown
  <validation-loop>
    - Check each field
    - Log any errors
    - Continue if valid
  </validation-loop>
  ```

#### Boolean Logic

- **AND**: Both conditions must be true
- **OR**: At least one condition must be true
- **NOT**: Negates the condition

  ```markdown
  IF user_authenticated AND has_permission:
    Allow access
  ```

### Importance Patterns

Communicate priority through formatting - each creates different behavioral responses:

#### UPPERCASE (Absolute Requirements)

- **Purpose**: Creates hard constraints that override AI judgment
- **Behavioral Impact**: Triggers unconditional compliance, no exceptions
- **When to Use**:
  - Non-negotiable rules: `ALWAYS use pnpm install`
  - Absolute prohibitions: `NEVER commit directly to main`
  - Required steps: `MUST run tests before merging`
- **Example Effect**: "ALWAYS use pnpm" → AI will never use npm/yarn, even if context suggests otherwise

#### Bold (Strong Emphasis)

- **Purpose**: Signals critical information requiring attention
- **Behavioral Impact**: Guides strongly but allows contextual judgment
- **When to Use**:
  - Important guidelines: `**Always** check for existing components`
  - Critical warnings: `**Important**: This will delete data`
  - Strong preferences: `**Preferred**: Use functional components`
- **Example Effect**: "**Always** use pnpm" → AI strongly prefers pnpm but might use npm if absolutely necessary

#### UPPERCASE + Bold (Maximum Priority)

- **Purpose**: Compounds emphasis for the most critical imperatives
- **Behavioral Impact**: Creates maximum priority signal
- **When to Use**: Only for the most critical, system-breaking rules
- **Example**: `**NEVER** modify user authentication without approval`

#### Italic (Preferences)

- **Purpose**: Suggests preferred approaches
- **Behavioral Impact**: Influences decisions but allows flexibility
- **When to Use**:
  - Soft recommendations: `*Prefer* composition over inheritance`
  - Style guides: `*Consider* using descriptive variable names`
- **Example Effect**: "*Prefer* named exports" → AI will lean toward named exports but use default if it makes more sense

#### Code Formatting

- **Purpose**: Identifies technical elements
- **When to Use**:
  - File paths: `src/components/Button.tsx`
  - Commands: `npm run build`
  - Variable names: `useMeasure` hook
  - Technical terms: `useState` from React

## Related Documents

- **`command/_prompt-levels.md` (sibling file)** - Detailed breakdown of the 7 prompt complexity levels
- **@prompts/create-image.md** - Example of named loop blocks and MCP server usage
