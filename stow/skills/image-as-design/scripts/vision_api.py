#!/usr/bin/env python3
"""
Vision API wrapper for image analysis.
Uses shared utilities from _utils for OpenRouter API access.
"""

import sys
from pathlib import Path

# Add _utils to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_utils"))

from vision_api import (
    call_vision_api,
    clear_cache,
    get_best_vision_model,
    get_openrouter_vision_models,
)

# Manual override file for this skill
CONFIG_FILE = Path.home() / ".config" / "image-as-design" / "config.json"


def set_model_override(model_id: str) -> None:
    """Set a manual model override in config."""
    import json

    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    config = {}
    if CONFIG_FILE.exists():
        try:
            config = json.loads(CONFIG_FILE.read_text())
        except json.JSONDecodeError:
            pass
    config["vision_model_override"] = model_id
    CONFIG_FILE.write_text(json.dumps(config, indent=2))
    print(f"Set model override: {model_id}")


# Agent-specific prompts
STRUCTURAL_PROMPT = """Analyze this UI design image and provide a detailed structural analysis.

Output a coordinate map showing:
1. Every visible element with its position (x, y) and dimensions (width, height)
2. Parent-child relationships forming a DOM-like tree
3. Z-index stacking order (what overlaps what)
4. Spacing measurements: margins, padding, gaps between elements

Use this format:
```
## Structure (Coordinate Map)
element-name: x,y → width,height
  child-element: x,y → width,height (relative to parent)
```

Be precise with measurements. Use percentages for fluid widths, pixels for fixed dimensions.
Include alignment info (centered, left-aligned, right-aligned, etc.)."""

DESIGN_INTENTION_PROMPT = """Analyze this UI design image and identify the design intention.

Provide:
1. **Primary Goal**: What is this UI trying to achieve? (e.g., lead generation, content display, navigation)
2. **Visual Hierarchy**: What draws attention first, second, third?
3. **User Flow**: What path should a user take through this interface?
4. **Emotional Tone**: What feeling does this design evoke? (professional, playful, minimal, etc.)
5. **Interaction Hints**: What elements suggest interactivity? What states might they have?
6. **Accessibility Considerations**: Any concerns for screen readers, color contrast, etc.

Focus on WHY design choices were made, not just WHAT they are."""

ELEMENT_CATALOG_PROMPT = """Analyze this UI design image and create a complete element inventory.

Create a table with ALL visible elements:

| Element ID | Semantic Type | Content/Purpose | Interactive States |
|------------|---------------|-----------------|-------------------|

For each element include:
- A unique identifier (e.g., header-logo, nav-link-1, hero-cta)
- Semantic HTML type (h1, button, a, img, input, div, section, etc.)
- Text content or purpose description
- Interactive states if applicable (hover, focus, active, disabled, error, success)

Also identify:
- Form elements with their input types and validation hints
- Images with their apparent purpose (decorative, informational, logo)
- Any icons and their meaning"""

DESIGN_SYSTEM_PROMPT = """Analyze this UI design image and extract design system tokens.

Extract and document:

## Colors
- Primary color(s)
- Background color(s)
- Text color(s)
- Accent/highlight colors
- Border colors
- Shadow colors

## Typography
- Heading font family and weights
- Body font family and weights
- Font sizes used (estimate in px or rem)
- Line heights
- Letter spacing if notable

## Spacing
- Base spacing unit
- Common spacing values used
- Padding patterns
- Margin patterns
- Gap sizes

## Borders & Shapes
- Border radius values
- Border widths
- Border styles

## Shadows
- Box shadow definitions
- Any drop shadows or glows

## Tailwind Mappings (if applicable)
Map each token to the closest Tailwind utility class:
- primary → blue-500
- spacing-md → p-4
- etc.

If no exact Tailwind match, suggest custom CSS variable."""


def analyze_structural(image_path: str, model: str | None = None) -> str:
    return call_vision_api(image_path, STRUCTURAL_PROMPT, model)


def analyze_design_intention(image_path: str, model: str | None = None) -> str:
    return call_vision_api(image_path, DESIGN_INTENTION_PROMPT, model)


def analyze_elements(image_path: str, model: str | None = None) -> str:
    return call_vision_api(image_path, ELEMENT_CATALOG_PROMPT, model)


def analyze_design_system(image_path: str, model: str | None = None) -> str:
    return call_vision_api(image_path, DESIGN_SYSTEM_PROMPT, model)


def main():
    """CLI interface."""
    if len(sys.argv) < 2:
        print("Usage: vision_api.py <command> [args...]")
        print("\nCommands:")
        print("  best-model               Show the current best vision model")
        print("  list-models              List available OpenRouter vision models")
        print("  set-model <id>           Set manual model override")
        print("  clear-cache              Clear cached data")
        print(
            "  analyze <image> <type>   Run analysis (structural, intention, elements, design-system, all)"
        )
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "best-model":
        model = get_best_vision_model(CONFIG_FILE)
        print(f"Best vision model: {model}")
        return

    if cmd == "list-models":
        models = get_openrouter_vision_models()
        print(f"Found {len(models)} vision-capable models:\n")
        for m in models[:20]:
            print(f"  {m['id']}")
        return

    if cmd == "set-model":
        if len(sys.argv) < 3:
            print("Usage: vision_api.py set-model <model-id>")
            sys.exit(1)
        set_model_override(sys.argv[2])
        return

    if cmd == "clear-cache":
        clear_cache()
        return

    if cmd == "analyze":
        if len(sys.argv) < 4:
            print("Usage: vision_api.py analyze <image_path> <analysis_type>")
            sys.exit(1)
        image_path = sys.argv[2]
        analysis_type = sys.argv[3]
        model = sys.argv[4] if len(sys.argv) > 4 else None
    else:
        # Legacy mode
        image_path = cmd
        if len(sys.argv) < 3:
            print("Usage: vision_api.py <image_path> <analysis_type> [model]")
            sys.exit(1)
        analysis_type = sys.argv[2]
        model = sys.argv[3] if len(sys.argv) > 3 else None

    analyzers = {
        "structural": analyze_structural,
        "intention": analyze_design_intention,
        "elements": analyze_elements,
        "design-system": analyze_design_system,
    }

    if analysis_type == "all":
        for name, func in analyzers.items():
            print(f"\n{'=' * 60}")
            print(f"=== {name.upper()} ANALYSIS ===")
            print(f"{'=' * 60}\n")
            print(func(image_path, model))
    elif analysis_type in analyzers:
        print(analyzers[analysis_type](image_path, model))
    else:
        print(f"Unknown analysis type: {analysis_type}")
        print(f"Valid types: {', '.join(analyzers.keys())}, all")
        sys.exit(1)


if __name__ == "__main__":
    main()
