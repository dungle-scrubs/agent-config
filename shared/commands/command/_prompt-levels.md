# Prompt Levels Guide

A conceptual framework for understanding prompt complexity and choosing appropriate structures. These levels are non-exhaustive - the possibilities are endless.

## Level 1: Basic Prompt

Simple task-focused instructions

> A straightforward prompt with minimal structure for simple tasks.

### Level 1 Characteristics

- Direct instructions
- Single purpose
- Minimal sections needed
- Quick execution

### Level 1 Sections

- Purpose/Task
- Basic instructions

### Level 1 Examples

- `.claude/commands/quick_fix.md`
- `.claude/commands/simple_search.md`

---

## Level 2: Workflow Prompt

Sequential step-by-step execution

> A prompt with clear sequential steps that execute in order.

### Level 2 Characteristics

- Step-by-step workflow
- Linear execution
- Clear success criteria
- Maps to todo lists

### Level 2 Sections

- Purpose
- Workflow (numbered steps)
- Success criteria
- ...same as Level 1

### Level 2 Examples

- `.claude/commands/build_component.md`
- `.claude/commands/run_tests.md`

---

## Level 3: Control Flow Prompt

Conditional logic and loops

> A prompt that includes branching logic, loops, and conditional execution.

### Level 3 Characteristics

- IF/THEN/ELSE conditions
- FOR EACH and WHILE loops
- Early returns and guard clauses
- Complex decision trees

### Level 3 Sections

- Variables (for conditions)
- Workflow with control flow
- Error handling
- ...same as previous levels

### Level 3 Examples

- `.claude/commands/process_files.md`
- `.claude/commands/validate_and_fix.md`

---

## Level 4: Delegate Prompt

Multi-agent coordination

> A prompt that delegates work to other agents (primary or subagents).

### Level 4 Characteristics

- Orchestrates multiple agents
- Delegates specialized tasks
- Coordinates results
- Manages agent configurations

### Level 4 Sections

- Variables w/agent config (model, count, tools, etc)
- Agent delegation workflow
- Result aggregation
- ...same as previous levels

### Level 4 Examples

- `.claude/commands/parallel_subagents.md`
- `.claude/commands/load_ai_docs.md`
- `.claude/commands/background.md`

---

## Level 5: Higher Order Prompt

Accepts other prompts as input

> A prompt that takes other prompts as parameters and executes them.

### Level 5 Characteristics

- Meta-programming capabilities
- Prompt composition
- Dynamic prompt execution
- Recursive possibilities

### Level 5 Sections

- Input prompt handling
- Prompt transformation logic
- Execution strategy
- ...same as previous levels

### Level 5 Examples

- `.claude/commands/run_prompt.md`
- `.claude/commands/chain_prompts.md`

---

## Level 6: Template Metaprompt

Generates new prompts dynamically

> A prompt that creates other prompts based on templates and patterns.

### Level 6 Characteristics

- Dynamic prompt generation
- Template-based creation
- Pattern recognition
- Adaptive structure

### Level 6 Sections

- Template (required)
- Generation rules
- Pattern matching
- Output format
- ...same as previous levels

### Level 6 Examples

- `.claude/commands/t_metaprompt_workflow.md`
- `.claude/commands/plan_vite_vue.md`
- `.claude/commands/create_agent.md`

---

## Level 7: Self-Improving Prompt

Evolves based on usage and feedback

> A prompt that modifies itself based on execution results and user feedback.

### Level 7 Characteristics

- Self-modification capability
- Learns from execution
- Adapts to patterns
- Optimizes over time

### Level 7 Sections

- Learning rules
- Feedback processing
- Self-modification logic
- Version tracking
- ...same as previous levels

### Level 7 Examples

- `.claude/commands/adaptive_optimizer.md`
- `.claude/commands/learning_agent.md`

---

## Choosing the Right Level

Consider these factors when selecting a prompt level:

1. **Task Complexity**: Simple tasks → Lower levels; Complex orchestration → Higher levels
2. **Control Needs**: Static execution → Level 1-2; Dynamic branching → Level 3+
3. **Agent Integration**: Single execution → Level 1-3; Multi-agent → Level 4+
4. **Adaptability**: Fixed behavior → Level 1-4; Dynamic generation → Level 5-7

## Key Principles

- **Start Simple**: Begin with the lowest level that meets your needs
- **Add Complexity Gradually**: Only move to higher levels when necessary
- **Combine Patterns**: Mix elements from different levels as needed
- **Focus on Clarity**: More complex doesn't mean better - clarity wins

## Section Usage by Level

| Section | L1 | L2 | L3 | L4 | L5 | L6 | L7 |
|---------|----|----|----|----|----|----|-----|
| Purpose | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workflow | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Variables | - | ○ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Control Flow | - | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agent Config | - | - | - | ✓ | ○ | ○ | ○ |
| Template | - | - | - | - | - | ✓ | ○ |
| Learning Rules | - | - | - | - | - | - | ✓ |

Legend: ✓ = Commonly used, ○ = Optional, - = Rarely needed

Remember: These levels are conceptual guides, not rigid requirements. Mix and match patterns to create the most effective prompt for your specific needs.
