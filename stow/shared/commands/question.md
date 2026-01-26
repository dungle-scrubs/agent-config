---
description: Inquire about LLM internal decision-making processes without triggering actions
version: "1.0"
encoding: "utf-8"
---

# Question Command

## Purpose

This command analyzes Claude's internal decision-making processes, reasoning,
and behavior patterns within the Claude Config system. It provides explanations
first, then asks for user permission before optionally running question-fixer
to resolve any identified issues.

## Workflow

**STEP 1 - ANALYSIS & EXPLANATION:**

- Analyze the question and identify potential systemic issues
- Explain WHY certain behaviors occurred or didn't occur
- Describe decision-making logic and triggers that led to specific choices
- Clarify how the Claude Config system influences behavior selection
- **PROVIDE ACTIONABLE RECOMMENDATIONS**: Specifically identify what changes are needed
- **SUGGEST PROMPTING REFINEMENTS**: Recommend specific prompt/instruction changes that could prevent this issue in the future (e.g., additions to CLAUDE.md, personality reminders, system prompts, or behavioral guidelines)

**STEP 2 - USER APPROVAL FOR FIXING:**

- IF issues are identified that question-fixer could resolve
- Ask explicit yes/no question: "Would you like me to fix these issues automatically using question-fixer?"
- Wait for user response
- ONLY trigger question-fixer if user explicitly approves

**CRITICAL RULES:**

- Do NOT run question-fixer without explicit user approval
- Always explain issues first before asking about fixing
- Respect user choice if they decline automatic fixing

## Usage

```bash
/question "why didn't you run the memory-buddy agent after I created those files?"
/question "what triggers cause you to load tech-stack.md automatically?"
/question "how do you decide when to use the Task agent vs reading files directly?"
/question "why did you choose to use Task agent instead of reading the file directly?"
```

## Command Implementation

```xml
<analysis-and-approval-mode>
The user is asking: {{args}}

STEP 1 - EXPLANATION PHASE:
- Analyze the question to identify systemic issues or gaps
- Explain your internal decision-making processes and reasoning
- Describe logic, triggers, and contextual factors that influenced decisions
- Focus on WHY you made certain choices or didn't make them
- **PROVIDE SPECIFIC RECOMMENDATIONS**: Identify exactly what changes are needed
- **SUGGEST PROMPTING REFINEMENTS**: Propose specific prompt/instruction additions that could prevent this issue (e.g., "Add to CLAUDE.md: 'When accessing external APIs, try the direct API approach first before asking for credentials'")

STEP 2 - APPROVAL PHASE (if issues identified):
- IF you identified issues that question-fixer could resolve:
  - Clearly explain what issues were found and their impact
  - Ask: "Would you like me to fix these issues automatically using question-fixer? (yes/no)"
  - WAIT for explicit user approval
  - IF user says "yes" → trigger @agent:question-fixer
  - IF user says "no" → provide manual fix recommendations and stop

CRITICAL CONSTRAINTS:
- NEVER run question-fixer without explicit "yes" approval
- Always explain first, ask permission second
- Respect user agency in deciding whether to apply automatic fixes
</analysis-and-approval-mode>
```

## Expected Response Format

### Step 1 - Explanation Response

1. **Direct Answer**: Explain the specific behavior or decision being questioned
2. **Reasoning**: Describe the logic, triggers, or context that influenced the decision
3. **System Context**: How Claude Config instructions, global context, or CLAUDE.md affected the choice
4. **Issues Identified**: Any systemic problems or gaps that were discovered
5. **Specific Recommendations**: Exactly what needs to change to achieve expected result
6. **Prompting Refinements**: Concrete prompt/instruction additions to prevent this issue in future sessions (provide exact text to add to CLAUDE.md, personality reminders, or system prompts)

### Step 2 - Approval Request (if issues found)

6. **Issue Summary**: Brief summary of fixable issues found
7. **Approval Question**: "Would you like me to fix these issues automatically using question-fixer? (yes/no)"
8. **Wait for Response**: Do not proceed until user explicitly approves or declines

## Examples

### Example 1: Missing Agent Triggers

**Question**: "why didn't you run memory-buddy after creating files?"

**Step 1 Response**:

- Explain which triggers were/weren't detected
- Describe instruction precedence and conditional loading
- Identify missing trigger instructions in CLAUDE.md

**Step 2 Response** (if issues found):

- "I found missing trigger instructions for memory-buddy in your CLAUDE.md file. Would you like me to fix these issues automatically using question-fixer? (yes/no)"

### Example 2: Workflow Inconsistencies

**Question**: "why did you load standards files in this case but not that case?"

**Step 1 Response**:

- Explain conditional loading logic differences
- Describe context checking mechanisms
- Identify inconsistent trigger patterns

**Step 2 Response** (if issues found):

- "I identified inconsistent context loading patterns that could be standardized. Would you like me to fix these issues automatically using question-fixer? (yes/no)"

### Example 3: Inefficient Tool Usage

**Question**: "why did you think you couldn't access the Vercel Edge Config?"

**Step 1 Response**:

- Explain the failed approaches (CLI commands, wrong 1Password field)
- Identify the root cause (gave up too early, didn't try direct API)
- Note this was behavioral inefficiency, not a config issue

**Prompting Refinement**:

```markdown
Add to personality-reminders or CLAUDE.md:

- When accessing external service APIs, try the direct API approach first using available credentials before asking the user for IDs or connection strings
- If one credential field doesn't work (e.g., `credential`), check for alternative fields (e.g., `token`) in 1Password before giving up
- Prefer discovery endpoints (e.g., `GET /v1/edge-config`) over asking for specific IDs
```

**Step 2 Response**: No systemic fix needed - this was a behavioral pattern issue. The prompting refinement above can help prevent similar inefficiencies.
