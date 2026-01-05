---
description: Implement a design from image or Figma with autonomous visual iteration until 95% match
---

# Implement Design Command

## Purpose

Orchestrates the full design-to-code workflow: analyzes a design source (local image or Figma), generates implementation, and iteratively refines until the rendered output matches the design with 95%+ similarity.

**Key Feature**: Persistent memory files track element analysis, user corrections, and optimization history across sessions.

Supports multiple design sources:
- **Local image**: PNG, JPG, WebP file path
- **Figma URL**: Exports node as image via REST API
- **Figma selection**: Captures current selection via MCP

## Variables

- `$ARGUMENTS`: Design source or continuation flag. Can be:
  - Path to local image: `./designs/mockup.png`
  - Figma URL with node-id: `https://figma.com/file/ABC123/Design?node-id=1-2`
  - `figma:selection` - Use current Figma selection
  - `--continue <task-id>` - Resume a previous task (e.g., `--continue b2f9a3e`)

  If not provided, prompts user to choose source type.

## Usage Pattern

```text
# Local image (new task)
/implement-design ./path/to/design.png

# Figma URL (new task)
/implement-design https://figma.com/file/ABC123/Design?node-id=1-2

# Figma current selection (new task)
/implement-design figma:selection

# Continue a previous task
/implement-design --continue b2f9a3e

# Interactive (prompts for source)
/implement-design
```

## Prerequisites

- **For all sources**:
  - Dev server running (Vite, Next.js, Astro, etc.)
  - OpenRouter API key in `~/.env/models`
  - Pillow installed (`pip install Pillow`)
  - Playwright Chromium (`npx playwright install chromium`)

- **For Figma URL**:
  - Figma API token in `~/.env/services` as `FIGMA_TOKEN` or `FIGMA_TOKEN_<PROJECT>`

- **For Figma selection**:
  - Figma desktop app running with MCP enabled
  - Active selection in Figma

## Process Flow

### Step 0: Memory Initialization (BLOCKING - Cannot Skip)

**This step MUST complete before any other work begins.**

<memory-initialization>

**IF** `$ARGUMENTS` starts with `--continue`:
1. Extract `$TASK_ID` from arguments (e.g., `b2f9a3e`)
2. Search for memory file: `<project>/.claude/memory/design-impl-<task-id>-*.json`
3. **IF** found:
   - Load memory file as `$MEMORY`
   - Display resume summary:
     ```
     ═══════════════════════════════════════════════════
     Resuming Task: $TASK_ID
     ═══════════════════════════════════════════════════
     Target:     $MEMORY.task.target_image
     Component:  $MEMORY.task.name
     Progress:   $MEMORY.progress.current_similarity% (iteration $MEMORY.progress.iteration_count)

     Key Elements:
     - [List verified element counts from memory]

     Last Corrections:
     - [List recent user_corrections]
     ═══════════════════════════════════════════════════
     ```
   - Skip to Step 5 (Generate/Update Implementation)
4. **ELSE**: Report error "Task ID not found", list available tasks, stop execution

**ELSE** (new task):
1. Generate unique task ID: `$TASK_ID` = 7-character alphanumeric (e.g., `b2f9a3e`)
2. Get current date: `$DATE` = YYYYMMDD format
3. Create memory file path: `$MEMORY_PATH` = `<project>/.claude/memory/design-impl-$TASK_ID-$DATE.json`
4. Create directory if needed: `mkdir -p <project>/.claude/memory/`
5. Initialize memory file with skeleton:
   ```json
   {
     "id": "$TASK_ID",
     "created": "ISO timestamp",
     "last_updated": "ISO timestamp",
     "task": {
       "name": "",
       "description": "",
       "target_image": "",
       "implementation_file": "",
       "page_file": "",
       "dev_url": ""
     },
     "viewport": { "width": 0, "height": 0 },
     "progress": {
       "iteration_count": 0,
       "starting_similarity": 0,
       "current_similarity": 0,
       "peak_similarity": 0,
       "status": "initializing"
     },
     "identified_elements": {},
     "visual_patterns": {},
     "user_corrections": [],
     "optimization_history": [],
     "exceptions": { "description": "", "elements": [] },
     "notes": []
   }
   ```
6. Display to user:
   ```
   ═══════════════════════════════════════════════════
   New Task Created: $TASK_ID
   ═══════════════════════════════════════════════════
   Memory File: $MEMORY_PATH

   To continue this task later, use:
   /implement-design --continue $TASK_ID
   ═══════════════════════════════════════════════════
   ```

</memory-initialization>

### Step 1: Determine Source Type

**IF** `$ARGUMENTS` is empty:
- Ask user to choose source type:
  ```
  How would you like to provide the design?
  1. Local image file
  2. Figma URL (with node-id)
  3. Figma current selection
  ```
- Based on choice, prompt for required input

**ELSE IF** `$ARGUMENTS` starts with `http` and contains `figma.com`:
- Set `$SOURCE_TYPE` = "figma_url"
- Set `$FIGMA_URL` = `$ARGUMENTS`

**ELSE IF** `$ARGUMENTS` equals `figma:selection`:
- Set `$SOURCE_TYPE` = "figma_selection"

**ELSE**:
- Set `$SOURCE_TYPE` = "local_image"
- Set `$IMAGE_PATH` = `$ARGUMENTS`

### Step 2: Acquire Design Image

<source-acquisition>

**IF** `$SOURCE_TYPE` == "local_image":
- Validate file exists at `$IMAGE_PATH`
- Validate file is an image (PNG, JPG, JPEG, WebP)
- Set `$DESIGN_IMAGE` = `$IMAGE_PATH`

**ELSE IF** `$SOURCE_TYPE` == "figma_url":
- Extract file key and node-id from URL
- Ask: "Which project token should I use? (or press Enter for default)"
- Export image via REST API:
  ```python
  from figma_rest_client import FigmaRESTClient

  client = FigmaRESTClient(project="$PROJECT")
  images = client.export_from_url("$FIGMA_URL", format="png", scale=2.0)
  # Download and save to ./figma-exports/
  ```
- Set `$DESIGN_IMAGE` = downloaded image path
- **Also extract design context**:
  ```python
  nodes = client.get_nodes_from_url("$FIGMA_URL")
  # Store for implementation guidance
  ```

**ELSE IF** `$SOURCE_TYPE` == "figma_selection":
- Verify Figma desktop app is running
- Capture screenshot via MCP:
  ```python
  from figma_session import FigmaSession

  session = FigmaSession().start()
  screenshot = session.get_screenshot()
  # Save to ./figma-exports/selection_<timestamp>.png
  ```
- Set `$DESIGN_IMAGE` = screenshot path
- **Also extract design context**:
  ```python
  context = session.get_design_context()
  variables = session.get_variable_defs()
  ```

</source-acquisition>

**IF** image acquisition failed:
- Report error with details
- Suggest troubleshooting steps based on source type
- Stop execution

**Update memory file**:
```json
{
  "task.target_image": "$DESIGN_IMAGE",
  "task.source_type": "$SOURCE_TYPE"
}
```

### Step 3: Gather Environment Information

**Ask user**:
1. "What is your dev server URL?" (e.g., `http://localhost:3000`)
2. "What framework are you using?" (React, Next.js, Vue, HTML, etc.)
3. "What is the target file path for the implementation?" (e.g., `src/pages/index.tsx`)
4. "What should this component be named?" (e.g., `product-showcase-hero`)

Store responses as:
- `$DEV_URL`
- `$FRAMEWORK`
- `$TARGET_FILE`
- `$COMPONENT_NAME`

**Update memory file**:
```json
{
  "task.name": "$COMPONENT_NAME",
  "task.implementation_file": "$TARGET_FILE",
  "task.dev_url": "$DEV_URL",
  "task.framework": "$FRAMEWORK"
}
```

### Step 4: Structural Analysis (BLOCKING - Before Any Code)

**This step MUST complete with user verification before generating code.**

<structural-analysis>

1. **Run full image-as-design analysis** with ALL 4 parallel agents:
   ```bash
   python ~/.claude/skills/image-as-design/scripts/vision_api.py analyze "$DESIGN_IMAGE" all
   ```

2. **Extract and populate memory** with:
   - Canvas dimensions (viewport)
   - Complete element inventory with EXACT counts
   - Container hierarchy (what contains what)
   - Overflow behavior (what breaks out of containers)
   - Z-index stacking order
   - Position and size measurements

3. **Display structural summary for verification**:
   ```
   ═══════════════════════════════════════════════════
   Structural Analysis Complete - Task: $TASK_ID
   ═══════════════════════════════════════════════════

   Canvas: ${width} × ${height}px

   Element Inventory:
   ┌─────────────────────────────────────────────────┐
   │ Element Type        │ Count │ Container        │
   ├─────────────────────────────────────────────────┤
   │ Review Cards        │ 5     │ cards_container  │
   │ Platform Cards      │ 2     │ left_column      │
   │ Sync Indicator      │ 1     │ dashboard        │
   └─────────────────────────────────────────────────┘

   Container Relationships:
   - cards_container: contains 5 cards, card #5 BREAKS OUT
   - cards_container: aligns with sync_indicator (680px width)

   ═══════════════════════════════════════════════════

   Is this analysis correct? [Y/n]
   If not, please specify corrections:
   ```

4. **BLOCK and wait for user confirmation**:
   - **IF** user confirms: Proceed to Step 5
   - **IF** user provides corrections:
     - Update `identified_elements` in memory
     - Add to `user_corrections[]` array with timestamp
     - Re-display summary and ask again
   - **DO NOT proceed until user confirms element counts are correct**

</structural-analysis>

**Update memory file** with full structural analysis:
```json
{
  "viewport": { "width": X, "height": Y },
  "progress.status": "analyzed",
  "identified_elements": { ... full element tree ... },
  "visual_patterns": { ... alignment rules, overflow behavior ... }
}
```

### Step 5: Generate Initial Implementation

**First, load memory file** and display current state:
```
Task: $TASK_ID | Status: $MEMORY.progress.status
Elements: [summary from memory]
Patterns: [key rules from memory]
```

Based on memory's `identified_elements` and `$FRAMEWORK`:

1. Create the implementation file at `$TARGET_FILE`
2. Apply framework-appropriate patterns:
   - **React/Next.js**: Functional components with Tailwind
   - **Vue**: Single-file components
   - **HTML**: Semantic HTML with CSS custom properties
3. Use extracted design tokens for styling
4. Implement all identified components and layout

**IMPORTANT - Reference memory for**:
- Exact element counts (verified by user)
- Container relationships and alignment rules
- Overflow behavior (which elements break out)
- Any user corrections from Step 4

**Update memory file**:
```json
{
  "progress.status": "implementing"
}
```

### Step 6: Visual Comparison Loop

**Initialize**:
- `$ITERATION` = `$MEMORY.progress.iteration_count` + 1
- `$MAX_ITERATIONS` = 20
- `$SIMILARITY_THRESHOLD` = 95

<comparison-loop>

**FOR EACH** iteration until `$SIMILARITY` >= `$SIMILARITY_THRESHOLD` OR `$ITERATION` > `$MAX_ITERATIONS`:

1. **Load memory file** (REQUIRED before each iteration):
   - Read current `identified_elements`
   - Read `visual_patterns` and rules
   - Read recent `user_corrections`
   - Display brief status:
     ```
     ───────────────────────────────────────────────────
     Task: $TASK_ID | Iteration: $ITERATION
     Key: [element counts] | Rules: [active patterns]
     ───────────────────────────────────────────────────
     ```

2. **Run image-diff comparison**:
   ```bash
   python ~/.claude/skills/image-diff/scripts/image_diff.py \
     --target "$DESIGN_IMAGE" \
     --url "$DEV_URL" \
     --json
   ```

3. **Parse results**:
   - Extract `similarity_percent` as `$SIMILARITY`
   - Extract `tier` as `$TIER`
   - Extract `ai_analysis` as `$FEEDBACK`

4. **Update memory immediately**:
   ```json
   {
     "progress.iteration_count": $ITERATION,
     "progress.current_similarity": $SIMILARITY,
     "progress.peak_similarity": max($SIMILARITY, $MEMORY.progress.peak_similarity),
     "last_updated": "ISO timestamp",
     "optimization_history[]": { "iteration": $ITERATION, "change": "description", "similarity": $SIMILARITY }
   }
   ```

5. **Report progress**:
   ```
   Iteration $ITERATION: $SIMILARITY% similarity ($TIER)
   Peak: $MEMORY.progress.peak_similarity%
   ```

6. **IF** `$SIMILARITY` >= `$SIMILARITY_THRESHOLD`:
   - Update memory: `progress.status = "completed"`
   - **BREAK** loop - implementation complete

7. **IF** `$ITERATION` >= `$MAX_ITERATIONS`:
   - Report: "Max iterations reached. Final similarity: $SIMILARITY%"
   - Ask user if they want to continue or accept current state
   - **BREAK** loop if user accepts

8. **Check for user input/corrections**:
   - **IF** user provides feedback (e.g., "there are 5 cards not 6"):
     - **IMMEDIATELY** update memory:
       ```json
       {
         "user_corrections[]": {
           "timestamp": "ISO",
           "iteration": $ITERATION,
           "issue": "what was wrong",
           "correction": "what user said"
         },
         "identified_elements.X": { updated values }
       }
       ```
     - Write memory file to disk (don't just hold in memory)
     - Apply correction to implementation

9. **Apply fixes based on $FEEDBACK**:
   - Reference memory for element positions and rules
   - Read the `recommendations` array
   - Apply each fix to `$TARGET_FILE`
   - **CRITICAL**: Check memory's `visual_patterns` before making changes
   - Wait for HMR to update the page (2-3 seconds)

10. **Increment** `$ITERATION`

</comparison-loop>

### Step 7: Final Report

**Update memory file**:
```json
{
  "progress.status": "completed" | "partial",
  "last_updated": "ISO timestamp"
}
```

Generate completion report:

```
═══════════════════════════════════════════════════
Design Implementation Complete
═══════════════════════════════════════════════════

Task ID:        $TASK_ID
Source:         $SOURCE_TYPE
Design Image:   $DESIGN_IMAGE
Implementation: $TARGET_FILE
Dev Server:     $DEV_URL

Final Similarity: $SIMILARITY%
Iterations:       $ITERATION
Peak Similarity:  $MEMORY.progress.peak_similarity%
Status:           [COMPLETE | PARTIAL]

Memory File:    $MEMORY_PATH
To continue:    /implement-design --continue $TASK_ID

Output Files:
- Implementation: $TARGET_FILE
- Memory: $MEMORY_PATH
- Final Screenshot: ./image-diff-output/screenshot_*.png
- Diff Report: ./image-diff-output/report_*.json
═══════════════════════════════════════════════════
```

## Memory File Schema

### File Naming Convention

**Format**: `design-impl-<uid>-<YYYYMMDD>.json`

- `uid`: 7-character unique alphanumeric ID (generated at task start)
- `YYYYMMDD`: Creation date for human readability
- Example: `design-impl-b2f9a3e-20251219.json`

**Location**: `<project_root>/.claude/memory/`

### Complete Schema

```json
{
  "id": "b2f9a3e",
  "created": "2025-12-19T10:30:00Z",
  "last_updated": "2025-12-19T11:10:00Z",

  "task": {
    "name": "component-name",
    "description": "Human-readable description",
    "target_image": "path/to/design.jpg",
    "implementation_file": "path/to/component.tsx",
    "page_file": "path/to/page.astro",
    "dev_url": "http://localhost:PORT/path",
    "framework": "React/Next.js/Vue/HTML",
    "source_type": "local_image/figma_url/figma_selection"
  },

  "viewport": {
    "width": 1408,
    "height": 768
  },

  "progress": {
    "iteration_count": 0,
    "starting_similarity": 0.0,
    "current_similarity": 0.0,
    "peak_similarity": 0.0,
    "status": "initializing|analyzed|implementing|iterating|completed|partial"
  },

  "identified_elements": {
    "element_group": {
      "total_count": 5,
      "verified_by_user": true,
      "container": {
        "width": 680,
        "alignment": "description of alignment rules"
      },
      "items": [
        {
          "id": 1,
          "description": "Human-readable description",
          "position": { "left": 0, "top": 0 },
          "size": "sm|md|lg or { width, height }",
          "z_index": 1,
          "breaks_container": false,
          "content": {}
        }
      ]
    }
  },

  "visual_patterns": {
    "pattern_name": {
      "description": "What this pattern enforces",
      "rule": "Specific implementation rule",
      "reason": "Why this pattern exists (often from user correction)"
    }
  },

  "user_corrections": [
    {
      "timestamp": "2025-12-19T10:35:00Z",
      "iteration": 5,
      "issue": "What was wrong",
      "correction": "What user said to fix it"
    }
  ],

  "optimization_history": [
    {
      "iteration": 1,
      "change": "Description of what changed",
      "similarity": 73.6
    }
  ],

  "exceptions": {
    "description": "Elements excluded from similarity comparison",
    "elements": [
      {
        "id": "element_id",
        "reason": "Why excluded",
        "asset_path": "Path to replacement asset if applicable"
      }
    ]
  },

  "notes": [
    "User-provided notes and preferences",
    "Important implementation decisions"
  ]
}
```

### Memory Operations

**MUST load memory before**:
- Each iteration of the comparison loop
- Applying any fixes
- Making structural changes

**MUST update memory after**:
- Any user correction (IMMEDIATELY, write to disk)
- Each iteration completion
- Any structural change
- Task completion or pause

**MUST verify from memory**:
- Element counts before assuming values
- Container relationships before positioning
- Visual patterns before making alignment changes

## Listing Available Tasks

To see all tasks that can be continued:

```bash
ls -la <project>/.claude/memory/design-impl-*.json
```

Display as:
```
Available tasks to continue:
- b2f9a3e (2025-12-19): real-time-sync-hero - 91.9% similarity
- a1c2d3e (2025-12-18): product-showcase-hero - 63.7% similarity
```

## Expected Outputs

### Success (95%+ match)

```text
═══════════════════════════════════════════════════
Design Implementation Complete
═══════════════════════════════════════════════════
Task ID: b2f9a3e
Source: figma_url
Final Similarity: 97.2%
Iterations: 4
Status: COMPLETE

To reference: /implement-design --continue b2f9a3e
═══════════════════════════════════════════════════
```

### Partial Success (max iterations)

```text
═══════════════════════════════════════════════════
Design Implementation - Max Iterations Reached
═══════════════════════════════════════════════════
Task ID: c3d4e5f
Source: local_image
Final Similarity: 91.8%
Iterations: 20
Status: PARTIAL - Manual review recommended

Memory preserved. To continue later:
/implement-design --continue c3d4e5f
═══════════════════════════════════════════════════
```

## Error Scenarios

- **Task ID not found**: List available task IDs from memory directory
- **Local image not found**: Report error with path, ask user to verify
- **Figma URL invalid**: Check URL format, ensure node-id is present
- **Figma token not found**: Guide user to set up `FIGMA_TOKEN` in `~/.env/services`
- **Figma MCP not responding**: Check Figma desktop app is running with MCP enabled
- **No Figma selection**: Ask user to select a frame/component in Figma
- **Dev server not responding**: Check if server is running, provide troubleshooting steps
- **Vision API error**: Check OPENROUTER_API_KEY in ~/.env/models
- **Similarity stuck/oscillating**: Check memory for user corrections, focus on structural issues first
- **Memory file corrupted**: Offer to create new task or attempt recovery

## Examples

<example>
Context: User starts a new design implementation

User: "/implement-design ./designs/landing-page.png"

Claude:
1. Generates task ID: `f7g8h9i`
2. Creates memory file: `.claude/memory/design-impl-f7g8h9i-20251219.json`
3. Displays: "New Task Created: f7g8h9i"
4. Validates image exists
5. Asks for dev server URL, framework, target file, component name
6. Runs structural analysis with 4 agents
7. Displays element summary:
   ```
   Element Inventory:
   - Review Cards: 5 (card #5 breaks container)
   - Platform Cards: 2
   Is this correct? [Y/n]
   ```
8. User confirms "Y"
9. Creates initial implementation
10. Iterates to 96% in 4 iterations
11. Reports complete with task ID for future reference
</example>

<example>
Context: User continues a previous task

User: "/implement-design --continue b2f9a3e"

Claude:
1. Finds memory file: `design-impl-b2f9a3e-20251219.json`
2. Displays resume summary:
   ```
   Resuming Task: b2f9a3e
   Target: images/app-store-02-sync_01.jpg
   Progress: 91.9% (iteration 25)
   Key Elements: 5 review cards, sync box 680px
   Last Correction: "cards align with sync box"
   ```
3. Continues from iteration 26
4. References all stored patterns and corrections
5. Doesn't re-ask structural questions (already verified)
</example>

<example>
Context: User provides correction during iteration

User: "There are 5 cards, not 6"

Claude:
1. IMMEDIATELY updates memory file:
   ```json
   {
     "user_corrections[]": {
       "timestamp": "2025-12-19T10:35:00Z",
       "iteration": 8,
       "issue": "Miscounted cards as 6",
       "correction": "There are exactly 5 cards"
     },
     "identified_elements.review_cards.total_count": 5
   }
   ```
2. Writes memory to disk
3. Acknowledges: "Updated: 5 cards (saved to memory)"
4. Applies fix to implementation
5. Continues iteration with correct count
</example>

## Best Practices

- **Always note your task ID** - You'll need it to continue later
- **Start dev server before running** - HMR provides instant feedback
- **Verify structural analysis carefully** - Mistakes here compound through iterations
- **Provide corrections immediately** - They're saved to memory for future reference
- **Use high-quality sources** - Higher resolution = better matching
- **Match viewport sizes** - Design and screenshot should have same dimensions
- **For Figma**: Select the top-level frame, not individual elements
- **Commit after completion** - Save your implementation once satisfied
- **Review diff images** - Visual diffs help understand remaining issues

## Related Commands

- `/design-to-code`: Analyze design without iteration (one-shot)
- `/visual-diff`: Run single comparison without implementation

## Notes

This command leverages multiple skills:
1. **mcp-figma**: Extracts design context and exports images from Figma
2. **image-as-design**: Analyzes mockup structure and extracts specs
3. **image-diff**: Compares rendered output to design
4. **mcp-playwright**: Captures screenshots from dev server

The 95% threshold is strict by design. For faster iterations during development, you can manually run image-diff with `--threshold-only` to skip AI analysis.

**Memory is Critical**: The memory file is the single source of truth. Every structural finding, user correction, and optimization attempt is recorded. The workflow blocks at critical points until structure is verified. This prevents miscounting elements, forgetting corrections, and re-analyzing from scratch.

**IMPORTANT**: The command modifies your target file during iteration. Consider working on a feature branch or having a clean git state before running.
