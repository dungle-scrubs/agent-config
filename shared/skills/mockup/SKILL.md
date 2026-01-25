---
name: mockup
description: Generate UI mockups and design images using Gemini Nano Banana Pro. Use when user says build mockup, generate mockup, create mockup, make mockup, design mockup, or references creating visual designs with optional reference images for style guidance.
allowed-tools: mcp__tool-proxy__execute_tool, mcp__tool-proxy__discover_tools, Read
---

# Mockup Generation Skill

## When to Use This Skill

This skill should be triggered when:

- User says "build mockup", "generate mockup", "create mockup", "make mockup"
- User wants to create UI designs, illustrations, or visual assets
- User provides a reference image and wants something similar
- User mentions "in the style of" or "like this" with an image

## Clipboard Image Integration

When the user pastes an image, a UserPromptSubmit hook automatically saves it to `/tmp/`.
Look for a message in context like:
```
Clipboard image saved to: /tmp/claude-pasted-1735225200.png
```

Use this path for the `reference_image` or `image_path` parameter.

**If no clipboard path is in context but user expects an image to be used, inform them:**
"I don't see a pasted image path in context. Please copy the image to your clipboard and submit your message again."

## Core Capabilities

1. **Text-to-Image Generation**: Create mockups from text descriptions using Gemini Nano Banana Pro
2. **Style Transfer**: Use reference images to guide style, composition, and aesthetic (up to 14 images)
3. **Resolution Control**: Output at 1K, 2K, or 4K resolution with various aspect ratios
4. **Goal-Based Naming**: Auto-increment filenames for iterative mockup sessions

## Instructions

### Basic Mockup Generation

Generate a mockup from a text prompt:

**Steps:**

1. Craft a detailed prompt describing the desired mockup
2. Call the image-generation tool with the prompt
3. Present the generated image path to the user

### Style-Guided Generation

Generate a mockup using a reference image for style guidance:

**Steps:**

1. Read the reference image path from the user
2. Craft a prompt that describes what to generate while referencing the style
3. Call generate_image with both prompt and reference_image
4. The Pro model supports up to 14 reference images for complex style mixing

## Available Tools

### Image Generation (via tool-proxy)

- **generate_image** - Generate AI image from text prompt with optional reference image
- **edit_image** - Modify existing images using AI instructions

## Usage

### Quick Start

```text
"Build a mockup of a login page with dark theme"
```

### With Reference Image

```text
"Generate a mockup like this image" (with image path)
"Build a landing page in the style of /path/to/reference.png"
```

### With Options

```text
"Create a 4K mockup of a dashboard at 16:9 aspect ratio"
```

## Tool Invocation

When generating mockups, use these parameters:

```json
{
  "app": "image-generation",
  "tool": "generate_image",
  "args": {
    "prompt": "...",
    "reference_image": "/path/to/reference.png",
    "model": "gemini-3-pro-image-preview",
    "aspect_ratio": "16:9",
    "image_size": "2K",
    "goal": "mockup-name",
    "output_dir": "./generated-images"
  }
}
```

### Default Model

Always use `gemini-3-pro-image-preview` (Nano Banana Pro) for mockups unless user specifies otherwise. This model provides:

- Higher quality output
- Better text rendering
- Support for up to 14 reference images
- 1K/2K/4K resolution options

### Aspect Ratios

- `1:1` - Square (icons, avatars)
- `16:9` - Widescreen (dashboards, landing pages)
- `9:16` - Portrait (mobile screens)
- `4:3` - Standard (general UI)
- `3:4` - Portrait standard
- `2:3` - Portrait (mobile)
- `3:2` - Landscape (desktop)
- `21:9` - Ultrawide (banners)

## Common Workflows

### Iterative Mockup Workflow

1. **Initial Generation** - Generate first mockup with goal name (e.g., "dashboard")
2. **Review and Iterate** - View result, refine prompt for next iteration
3. **Auto-Increment** - Files save as dashboard_01.png, dashboard_02.png, etc.

### Reference-Based Workflow

1. **Analyze Reference** - Understand the style elements in the reference image
2. **Craft Prompt** - Describe desired output while noting style to preserve
3. **Generate** - Call with both prompt and reference_image
4. **Iterate** - Adjust prompt or try different references

## Error Handling

- **Reference image not found**: Verify the path exists and is readable
- **Invalid aspect ratio**: Use one of the valid ratios listed above
- **Generation failed**: Check GEMINI_API_KEY is set in ~/.env/models
- **No image returned**: Model may have declined; try rephrasing the prompt

## Dependencies

### Required

- GEMINI_API_KEY in ~/.env/models
- tool-proxy MCP server running
- google-genai and pillow Python packages

## Examples

<example>
Context: User wants a simple UI mockup

User: "Build a mockup of a settings page"

Result: Calls generate_image with prompt describing a settings page, uses Pro model, saves to generated-images/
</example>

<example>
Context: User has a reference design

User: "Generate a mockup like this image /tmp/reference.png but with a blue color scheme"

Result: Calls generate_image with reference_image=/tmp/reference.png and prompt describing blue color scheme modifications
</example>

<example>
Context: User wants high-resolution dashboard

User: "Create a 4K mockup of an analytics dashboard at 21:9"

Result: Calls generate_image with image_size="4K", aspect_ratio="21:9", model="gemini-3-pro-image-preview"
</example>

## Notes

- Always use the Pro model (gemini-3-pro-image-preview) for mockups
- Include "goal" parameter for iterative sessions to get auto-incrementing filenames
- For style transfer, be explicit in the prompt about what to preserve vs. change
- The Pro model excels at text rendering - use it for UI mockups with labels
