---
description: Generate UI mockup images for rapid prototyping using AI image generation with optional S3 sharing
---

# Mockup Command

## Purpose

Rapidly prototype UI ideas during meetings by generating mockup images. Supports two modes:

1. **Edit mode**: Modify an existing screenshot/image while preserving design detail (small tweaks, adding elements)
2. **Reference mode**: Use an existing image as inspiration to generate a new feature visualization (more creative freedom)

Optionally upload to S3 for instant shareable links.

## Variables

- `$1` (optional): Path to source image for edit or reference
- `$ARGUMENTS`: Description of the desired mockup or changes

**Flags parsed from $ARGUMENTS:**
- `--edit`: Force edit mode (preserve source detail)
- `--reference` or `--ref`: Force reference mode (creative interpretation)
- `--share`: Upload result to S3 and return shareable URL
- `--no-card`: Skip auto-attaching to Notion card even if card reference detected
- `--no-ref`: Skip using the default homepage reference image

**Auto-detected from context:**
- **Card references**: If user mentions "card 123", "FU-123", "fu-123", or similar patterns, automatically upload to S3 AND attach the mockup to that Notion card. This is the default behavior when a card is referenced — no flags needed.

## Default Reference Image

**CRITICAL: Always use the Fuse homepage screenshot as style reference unless overridden.**

- **Default reference path:** `~/.claude/commands/assets/homepage.png`
- This ensures all mockups integrate with the existing Fuse design system (colors, typography, spacing, component patterns)
- Use `--no-ref` flag to generate without design system reference
- If user provides a different image path via `$1`, use that instead of the default

**Keeping the reference current:** Periodically update `homepage.png` with a fresh screenshot of the Fuse.is chat interface to reflect design system changes.

## Usage Pattern

```text
/mockup [image_path] <description> [--edit|--reference] [--share]
```

## Prerequisites

- MCP app `image-generation` configured with Gemini API key
- MCP app `aws` configured (only if using --share)
- S3 bucket configured for uploads (only if using --share)

## Process Flow

### Step 0: Handle Pasted Images in Conversation

**CRITICAL: Check for pasted/attached images BEFORE proceeding.**

When the user pastes or attaches an image directly in their message (not as a file path), Claude Code receives it as a base64-encoded image. This image MUST be saved to a temp file for the image-generation tools to use.

**Detection:**
- User says "use this image", "this screenshot", "reference image", or similar WITHOUT providing a file path
- User's message contains an attached/pasted image visible in the conversation
- Description mentions "like this", "based on this", "add to this" without a `$1` path

**Action when pasted image detected:**

```bash
# Save the pasted image to a known temp location
TEMP_PATH="/private/tmp/mockup-reference-$(date +%s).png"
# The pasted image data should be written to this path
# Then set: SOURCE_IMAGE="$TEMP_PATH"
```

**IMPORTANT:** If the user provides BOTH a pasted image AND mentions "reference image" or similar phrasing, you MUST:
1. Save the pasted image to temp
2. Use that temp path as the source image for edit_image or as reference
3. DO NOT skip the image and fall back to text-only generation

If no pasted image is detected and no `$1` path provided, proceed to Step 0.5.

### Step 0.5: Apply Default Reference Image

**IF no source image from Step 0 AND no `$1` path AND `--no-ref` flag NOT present:**
- Set `REFERENCE_IMAGE` = `~/.claude/commands/assets/homepage.png`
- Set `MODE` = "reference" (use homepage as style guide, not edit target)
- This ensures design system consistency across all mockups

**IF `--no-ref` flag present OR default reference doesn't exist:**
- Proceed without reference (pure text-to-image generation)
- Warn user if homepage.png is missing: "⚠️ Default reference missing. Run a screenshot capture to update ~/.claude/commands/assets/homepage.png"

**CRITICAL:** When calling `image-generation:generate_image`, pass the reference as:
```
reference_image: "/full/path/to/homepage.png"
```
NOT `reference_image_path`. The parameter name is `reference_image`.

### Step 1: Parse Input and Determine Mode

**IF $1 is a valid image path OR a pasted image was saved in Step 0 OR default reference applied in Step 0.5:**
  - **IF --edit flag present OR description contains edit triggers:**
    - Set MODE = "edit"
    - Preserve maximum detail from source
    - **Edit triggers:** "edit this", "modify this", "change this image", "update image", "fix image", "remove from", "add to image"
  - **ELSE IF --reference flag present OR description contains reference triggers:**
    - Set MODE = "reference"
    - Use source as style/layout inspiration
    - **Reference triggers:** "like this", "similar to", "based on this", "in the style of", "use as reference", "inspired by this"
  - **ELSE (ambiguous):**
    - Default to "edit" for small changes (single element additions/removals)
    - Default to "reference" for larger feature additions
**ELSE:**
  - Set MODE = "generate"
  - Create from text description only

**Parse --share flag** to determine if S3 upload is needed.

### Step 1.5: Detect Card References

**CRITICAL: Check for card references in user message or conversation context.**

Scan for patterns indicating a Notion card reference:
- `card \d+` (e.g., "card 953")
- `FU-\d+` or `fu-\d+` (e.g., "FU-876")
- `#\d{3,}` (e.g., "#953")

**IF card reference detected AND --no-card flag NOT present:**
- Set `CARD_ID` = extracted number (e.g., "953")
- Set `AUTO_SHARE` = true (implies --share behavior)
- Set `ATTACH_TO_CARD` = true

**This means:** When a user says "card 953 needs a mockup", the skill will:
1. Generate the mockup
2. Upload to S3 automatically
3. Attach the image to the Notion card with the disclaimer

### Step 2: Craft Optimized Prompt

**FOR edit mode:**
- Emphasize preserving existing design elements
- Be specific about what to change vs. keep
- Include: "Maintain exact styling, colors, fonts, spacing. Only modify: [specific changes]"

**FOR reference mode:**
- Describe the new feature/element to add
- Reference the source for style consistency
- Include: "Match the design system, color palette, and UI patterns from the reference"

**FOR generate mode:**
- Include full UI context in prompt
- Specify design system details (colors, fonts, spacing)
- Reference existing screenshots if available in conversation

### Step 3: Generate Image

**IF MODE = "edit":**
```
Use image-generation:edit_image
- image_path: $1
- prompt: [crafted edit prompt]
- goal: "mockup-edit"
```

**IF MODE = "reference" OR MODE = "generate":**
```
Use image-generation:generate_image
- prompt: [crafted generation prompt including reference description]
- aspect_ratio: [match source or "16:9" for desktop, "9:16" for mobile]
- goal: "mockup"
```

### Step 4: Display Result

Read and display the generated image to the user.

### Step 5: Apply Disclaimer Badge

**ALWAYS apply the badge to generated mockups:**

```bash
BADGE_PATH="~/.claude/commands/assets/mockup-badge.png"
magick [generated_image_path] $BADGE_PATH -gravity SouthEast -geometry +15+15 -composite [output_path]
```

This adds the "AI Mockup • May contain errors" badge to the lower-right corner.

### Step 6: S3 Upload

**IF --share flag is present OR AUTO_SHARE is true (card reference detected):**

1. Upload image to S3:
```bash
aws s3 cp [badged_image_path] s3://deckfusion-stage/mockups/[timestamp]-[goal].jpg
```

2. Construct public URL and copy to clipboard:
```bash
URL="https://deckfusion-stage.s3.amazonaws.com/mockups/[timestamp]-[goal].jpg"
echo "$URL" | pbcopy
echo "$URL"
```

3. Display the shareable URL to user (already in clipboard)

**Note:** The `mockups/` prefix has a bucket policy allowing public read access, so no presigning is needed. URLs are permanent.

### Step 7: Attach to Notion Card (if card reference detected)

**IF ATTACH_TO_CARD is true:**

1. Use Notion MCP to find the card by ID:
```
Use notion:search_pages with query "FU-{CARD_ID}" or card title
```

2. Determine appropriate placement in the card:
   - Look for existing "Mockup" or "Design" section
   - If none exists, add after the card description/overview section
   - If card has a "Scope" or "Implementation" section, add before it

3. Add the mockup image with disclaimer:
```
Use notion:append_block_children to add:
- Image block with S3 URL
- Quote block with italic text: "Not a design specification - intended to convey the general idea."
```

4. Report success:
```text
📎 Attached to card FU-{CARD_ID}
```

**IF card not found:** Report error but don't fail — the S3 URL is still valid and in clipboard.

## Expected Outputs

### Success (without --share)

```text
✅ Mockup generated successfully
📁 Location: ./generated-images/mockup_01.png
🎨 Mode: edit | reference | generate

[Image displayed inline]
```

### Success (with --share)

```text
✅ Mockup generated and uploaded
📁 Local: ./generated-images/mockup_01.jpg
🔗 Share URL: https://deckfusion-stage.s3.amazonaws.com/mockups/[file].jpg
📋 Copied to clipboard

[Image displayed inline]
```

### Success (with card reference)

```text
✅ Mockup generated and attached to card
📁 Local: ./generated-images/mockup_01.jpg
🔗 Share URL: https://deckfusion-stage.s3.amazonaws.com/mockups/[file].jpg
📎 Attached to card FU-953
📋 Copied to clipboard

[Image displayed inline]
```

### Error

```text
❌ Mockup generation failed
Error: [Specific error message]
💡 Tip: [Contextual suggestion]
```

## Error Scenarios

- **No description provided**: Prompt user for mockup description
- **Invalid image path**: Check path and suggest alternatives
- **Image generation failed**: Suggest prompt refinements
- **S3 upload failed**: Check AWS credentials and bucket permissions
- **API rate limit**: Wait and retry, or suggest trying later

## Examples

<example>
Context: User pastes an image directly in conversation with their request

User: [pastes screenshot of chat interface] "/mockup add memory saved indicators below the message content --edit"

Step 0: Detect pasted image, save to /private/tmp/mockup-reference-[timestamp].png
Mode: edit (user wants to modify the pasted screenshot)
Action: Use edit_image with the saved temp path
Result: Original screenshot with memory indicators added
</example>

<example>
Context: User pastes image as style reference for new feature

User: [pastes Fuse.is chat screenshot] "use this as a reference image to create a mockup showing notification toasts"

Step 0: Detect pasted image, save to temp
Mode: reference (creating new feature inspired by the style)
Action: Use generate_image with detailed prompt describing the reference style
Result: New mockup matching Fuse.is design system with notification toasts
</example>

<example>
Context: Mockup for a tracked card (auto-uploads and attaches to Notion)

User: "card 953 needs a mockup for clickable follow-up question chips"

Step 1.5: Detects "card 953" → CARD_ID=953, AUTO_SHARE=true, ATTACH_TO_CARD=true
Mode: generate (text-to-image)
Action: Generate mockup → Badge → Upload to S3 → Attach to Notion card FU-953
Result: Mockup displayed, S3 URL in clipboard, image added to Notion card with disclaimer
</example>

<example>
Context: Quick edit to existing settings page screenshot

User: "/mockup ./screenshot.png add a new 'Scorecards' tab next to Memory tab --edit"

Mode: edit (preserves existing design detail)
Result: Same screenshot with new tab added, matching existing style exactly
</example>

<example>
Context: Visualize a new feature using existing UI as reference

User: "/mockup ./settings-page.png add a day-of-week checkbox selector section with All/None buttons --reference --share"

Mode: reference (creative interpretation matching style)
Result: New mockup showing the feature, uploaded to S3 with shareable link
</example>

<example>
Context: Generate mockup from scratch

User: "/mockup dark mode dashboard with sidebar navigation, cards showing metrics, modern SaaS style"

Mode: generate (text-to-image)
Result: New dashboard mockup matching description
</example>

<example>
Context: Mobile app screen

User: "/mockup ./mobile-home.png add a floating action button in bottom right corner --edit --share"

Mode: edit
Result: Original screen with FAB added, shareable link provided
</example>

## Best Practices

- **For edits**: Be very specific about what to change and what to preserve
- **For references**: Describe the new feature in detail, let AI interpret the style
- **Include context**: Mention the app name, design system, or existing patterns
- **Iterate quickly**: Generate multiple versions with refined prompts
- **Use --share**: Get instant links for Slack/meeting sharing

## Tool Reference

### image-generation:edit_image
- Modifies existing image while preserving detail
- Best for: small UI tweaks, adding elements, color changes
- Preserves: layout, typography, spacing, design system

### image-generation:generate_image
- Creates new image from text (can reference style conceptually)
- Best for: new features, alternative layouts, creative exploration
- Freedom: interprets prompt creatively within style guidelines

### aws:call_aws
- S3 upload and presigned URL generation
- Used only when --share flag is present

## Adding Mockups to Documents

When adding mockups to Notion cards, documentation, or any other document:

1. Add the mockup image
2. **Immediately below the image**, add this disclaimer text:
   > *Not a design specification - intended to convey the general idea.*

This ensures viewers understand the mockup is conceptual, not a pixel-perfect design spec.

## Notes

- Generated images are saved to `./generated-images/` by default
- Edit mode prioritizes fidelity; reference mode prioritizes creativity
- S3 URLs are permanent (bucket policy allows public read on `mockups/*`)
- Badge asset located at `~/.claude/commands/assets/mockup-badge.png`
- Badge is always applied to mockups before upload (lower-right corner)
- S3 bucket: `deckfusion-stage` with public read policy for mockups prefix
- For meeting prototyping, generate multiple options quickly and iterate
- **Card references trigger full workflow**: Mentioning "card 123", "FU-123", etc. automatically uploads to S3 and attaches to the Notion card — no flags needed
- Use `--no-card` to generate a mockup without attaching to a detected card reference
