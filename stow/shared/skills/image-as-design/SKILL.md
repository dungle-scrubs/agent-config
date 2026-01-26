---
name: image-as-design
description: Analyze UI design images to generate implementation-ready code. Triggers: design to code, mockup to code, UI image analysis, implement this design, screenshot to code.
---

# Image-as-Design: UI Implementation from Images

## CRITICAL: Single Image Only

**STOP immediately if the user provides multiple images.** This skill processes ONE image at a time. If the user requests analysis of multiple images, respond:

> "This skill analyzes one image at a time for accurate UI extraction. Please provide a single image, and I'll give you comprehensive implementation instructions."

Do not continue processing. Wait for a single image.

## When to Use This Skill

This skill should be triggered when:

- User wants to convert a design mockup into code
- User has a screenshot/image and wants it implemented as UI
- User mentions "implement this design" or "code this UI"
- User asks to turn an image into HTML, React, Tailwind, etc.
- User wants design-to-code conversion

## Core Capabilities

1. **Parallel Multi-Perspective Analysis**: Spawns 4 specialized agents analyzing the same image simultaneously
2. **Consensus Building**: Combines agent outputs into unified, accurate specifications
3. **Framework-Aware Output**: Generates code specs for user's target framework (React, HTML, Vue, etc.)
4. **Design System Integration**: Maps to existing design tokens or generates new ones

## Vision Model Configuration

### API Key Resolution

1. **First**: Check `~/.env/models` for `OPENROUTER_API_KEY`
2. **Fallback**: Check `OPENROUTER_API_KEY` environment variable

### Model Selection: LMArena #1 Vision Model

The skill automatically uses the **#1 ranked Vision model from LMArena**:

1. **Scrape LMArena**: Fetch https://lmarena.ai/leaderboard/vision
2. **Extract #1 model**: Parse the page for the top-ranked vision model
3. **Map to OpenRouter**: Convert LMArena model name to OpenRouter ID
4. **Verify availability**: Confirm model exists on OpenRouter
5. **Fallback**: If scraping fails, use best available OpenRouter vision model

Results are cached for **24 hours** at `~/.cache/image-as-design/lmarena-vision-top.json`.

### CLI Commands

```bash
# Show the current best vision model (LMArena #1)
python scripts/vision_api.py best-model

# List all OpenRouter vision models
python scripts/vision_api.py list-models

# Clear cache to force fresh LMArena scrape
python scripts/vision_api.py clear-cache

# Manual override (if scraping fails)
python scripts/vision_api.py set-model openai/gpt-4o
```

### Manual Override

If LMArena scraping fails, set a manual override:

```bash
python scripts/vision_api.py set-model <openrouter-model-id>
```

This writes to `~/.config/image-as-design/config.json` and takes precedence over scraping.

## Parallel Analysis Architecture

Spawn **4 parallel Task agents** to analyze the image simultaneously:

### Agent 1: Structural Analyst

**Focus**: Spatial relationships, coordinates, element hierarchy

**Output Format**:
```
## Structure (Coordinate Map)
header: 0,0 → 100%,64px
  logo: 16px,16px → 48px,32px
  nav: right-aligned, gap=24px
main: 0,64px → 100%,auto
  hero: centered, max-w=1200px
    heading: centered, mb=24px
    button: centered, 120x40px
footer: 0,bottom → 100%,80px
```

**Deliverables**:
- Element bounding boxes (x, y, width, height)
- Parent-child relationships (DOM tree)
- Z-index stacking order
- Spacing measurements (margins, padding, gaps)

### Agent 2: Design Intention Analyst

**Focus**: Purpose, UX patterns, visual hierarchy

**Output Format**:
```
## Design Intention
- **Primary Goal**: Lead generation via signup form
- **Visual Hierarchy**: Logo → Headline → CTA → Secondary nav
- **User Flow**: Land → Read value prop → Click CTA → Convert
- **Emotional Tone**: Professional, trustworthy, modern
- **Interaction Hints**: Hover states on nav, button has prominence
```

**Deliverables**:
- Purpose of each section
- Intended user journey
- Emphasis/hierarchy analysis
- Accessibility considerations

### Agent 3: Element Cataloger

**Focus**: Component inventory, types, states

**Output Format**:
```
## Element Inventory
| Element | Type | Content | States |
|---------|------|---------|--------|
| logo | img | Brand logo | - |
| nav-link | a | Home, About, Contact | hover, active |
| hero-heading | h1 | "Welcome to..." | - |
| cta-button | button | "Get Started" | default, hover, focus |
| input-email | input[email] | placeholder | focus, error, valid |
```

**Deliverables**:
- Complete element list with semantic types
- Text content extraction
- Interactive states identified
- Form elements with validation hints

**CRITICAL: Icon & Logo SVG Recreation**

For every icon and logo in the design, provide a detailed visual description that enables accurate SVG recreation:

```
## Icon/Logo Specifications
| Element | Visual Description | SVG Approach |
|---------|-------------------|--------------|
| logo-icon | Stylized "A" shape - two diagonal lines meeting at apex, no crossbar, mountain-peak form | Single path with two strokes meeting at top point |
| cloud-icon | Rounded cloud outline with flat bottom edge, 3 bumps on top | Bezier curves for organic cloud shape |
| chart-icon | 4 vertical bars of varying heights, left-to-right ascending | Rectangle elements or single path |
```

**Icon Recreation Rules**:
1. **Never substitute generic icons** - always recreate the exact visual form from the design
2. **Describe shapes precisely** - "triangular A without crossbar" not just "logo icon"
3. **Note stroke vs fill** - whether icons use outlines or solid fills
4. **Capture proportions** - approximate aspect ratio and relative sizing
5. **Identify style** - rounded corners, sharp edges, line weight

**CRITICAL: Asset Extraction**

Identify visual elements that should be extracted as separate asset files:

```
## Asset Extraction
| Element | Type | Output Path | Notes |
|---------|------|-------------|-------|
| hero-background | SVG pattern | /assets/svg/hero-bg.svg | Recreate wave/blob pattern |
| testimonial-photo | JPG | /assets/jpg/testimonial-1.jpg | Rasterized headshot |
| product-mockup | PNG | /assets/png/product-mockup.png | Transparent background needed |
| decorative-blob | SVG | /assets/svg/blob-decoration.svg | Gradient blob shape |
```

**Asset Extraction Rules**:
1. **Background patterns/shapes** → Recreate as `/assets/svg/*.svg`
2. **Photos/rasterized images** → Extract as `/assets/jpg/*.jpg` (opaque backgrounds)
3. **Images requiring transparency** → Extract as `/assets/png/*.png` (cutout shapes, overlays)
4. **Decorative SVG elements** → Recreate as `/assets/svg/*.svg` (blobs, waves, geometric shapes)
5. **Always describe the asset** so it can be recreated or sourced appropriately

**When to Extract**:
- Background decorations that repeat or tile
- Hero images, photos, illustrations
- Product screenshots or mockups
- Decorative shapes that aren't simple CSS (gradients, organic forms)
- Any visual that would be impractical to recreate with pure CSS

### Agent 4: Design System Mapper

**Focus**: Tokens, patterns, framework translation

**Output Format**:
```
## Design Tokens
--color-primary: #3B82F6
--color-background: #FFFFFF
--color-text: #1F2937
--font-heading: 'Inter', sans-serif, 700
--font-body: 'Inter', sans-serif, 400
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 48px
--radius-sm: 4px
--radius-md: 8px
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)

## Tailwind Mappings
primary → blue-500
background → white
text → gray-800
spacing-md → p-4, m-4
radius-md → rounded-lg
```

**Deliverables**:
- Color palette extraction
- Typography scale
- Spacing system
- Border radius patterns
- Shadow definitions
- Framework-specific token mappings

## Consensus Building Process

After all 4 agents complete, synthesize their outputs:

### Step 1: Validate Consistency

- Cross-reference structural measurements with element catalog
- Verify design intentions align with element purposes
- Confirm design tokens match observed styles

### Step 2: Resolve Conflicts

If agents disagree:
- Prioritize Structural Analyst for measurements
- Prioritize Design Intention for semantic meaning
- Prioritize Element Cataloger for component types
- Prioritize Design System Mapper for tokens

### Step 3: Generate Unified Output

Combine into final specification format.

## Output Format

### Final Specification Structure

```markdown
# UI Implementation Specification

## Design Tokens
[Generated or mapped tokens]

## Component Tree
[Hierarchical structure with measurements]

## Element Specifications
[Detailed specs for each element]

## Implementation Notes
[Framework-specific guidance]

## Responsive Behavior
[Breakpoint recommendations]
```

## Framework-Specific Adaptations

### HTML + Vanilla CSS

```html
<!-- Generate semantic HTML structure -->
<!-- CSS custom properties for tokens -->
<!-- BEM or similar naming convention -->
```

### React + Tailwind

```tsx
// Functional components
// Tailwind utility classes
// Custom CSS variables for non-standard tokens
```

### Vue + CSS

```vue
<!-- Single-file components -->
<!-- Scoped styles -->
<!-- CSS custom properties -->
```

### Other Frameworks

Detect from project context:
- Check for `package.json` dependencies
- Look for existing component patterns
- Match existing naming conventions

## Usage

### Quick Start

User provides an image path or URL, then:

1. Skill validates single image
2. Spawns 4 parallel analysis agents
3. Each agent calls vision model API
4. Combines results into consensus
5. Outputs implementation-ready specification

### Example Workflow

```
User: "Convert this mockup to React + Tailwind" [attaches image]

Skill:
1. Validates single image ✓
2. Detects target: React + Tailwind
3. Spawns parallel agents
4. Generates specification with:
   - Tailwind token mappings
   - React component structure
   - JSX with className utilities
```

## Error Handling

- **Multiple images**: Stop and request single image
- **No image provided**: Ask user to provide image path/URL
- **Vision API failure**: Retry with fallback model, report if persistent
- **Ambiguous framework**: Ask user to specify target framework
- **Missing design system**: Generate new tokens from image analysis

## Dependencies

### Required

- OpenRouter API access (via `~/.env/models`)
- Vision-capable model access

### Optional

- Project `tailwind.config.js` for existing token mapping
- Project `package.json` for framework detection
- Existing design system files for token matching

## Examples

<example>
Context: User has a landing page screenshot and uses React + Tailwind

User: "Implement this design" [provides screenshot.png]

Result: Skill spawns 4 agents, analyzes image, outputs:
- Design tokens mapped to Tailwind classes
- React component hierarchy
- Element specifications with exact Tailwind utilities
- Responsive breakpoint recommendations
</example>

<example>
Context: User provides Figma export, no framework specified

User: "Turn this into code" [provides mockup.png]

Skill: "What framework should I target? Options:
- HTML + vanilla CSS
- React + Tailwind
- Vue + CSS
- Other (specify)"

User: "HTML + CSS"

Result: Semantic HTML with CSS custom properties and BEM naming
</example>

## Notes

- Always spawn all 4 agents in parallel for efficiency
- Vision model calls are the bottleneck - minimize by batching analysis prompts
- Design token extraction is approximate - user may need to refine exact values
- This skill complements but doesn't replace design handoff tools like Figma Dev Mode
- For complex multi-page designs, process one screen at a time
- **Icons and logos must be recreated to match the original form** - never substitute with generic alternatives
- **Extract assets to appropriate directories**: `/assets/svg/` for vector graphics, `/assets/jpg/` for photos, `/assets/png/` for images needing transparency

Remember: The goal is implementation-ready specifications with faithful visual reproduction. Recreate SVG icons to match their original shapes, and extract rasterized assets to the appropriate format and directory.
