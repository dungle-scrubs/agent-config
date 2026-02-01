---
name: icons
description: "Icon standards - Lucide first, Hero Icons second, Tabler for brands. No custom SVGs. Triggers: icons, icon library, SVG, Lucide, Hero Icons."
---

# Icon & SVG Standards

## CRITICAL RULES

**NEVER create custom SVGs or icons unless EXPLICITLY requested by the user.**
**ALWAYS use existing icon libraries in the priority order below.**

## When to Use This Skill

This skill should be triggered when:

- Adding icons to UI components
- Selecting an icon library for a project
- Implementing SVGs or icon systems
- Working with brand logos
- User mentions icons, SVGs, or visual indicators

## Icon Library Priority (STRICT ORDER)

### 1. Lucide (PRIMARY - Always Check First)

- **URL**: https://lucide.dev/icons/
- **Use for**: All general UI icons, navigation, actions
- **Framework packages**: lucide-react, lucide-vue-next, lucide-svelte, lucide-solid

```jsx
// React (PREFERRED)
import { Search, Menu, X } from 'lucide-react';

<Search size={24} />
```

```vue
<!-- Vue -->
<template>
  <Search :size="24" />
</template>

<script setup>
import { Search } from 'lucide-vue-next';
</script>
```

### 2. Hero Icons (SECONDARY)

- **URL**: https://heroicons.com/
- **Use for**: When Lucide doesn't have needed icon
- **Styles**: Outline (24px) and Solid (20px)

```jsx
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
```

### 3. Tabler Icons (BRANDS ONLY)

- **URL**: https://tabler.io/icons
- **Use for**: Brand/company logos ONLY

## Contextual Libraries (Specific Needs Only)

| Library | Use Case | URL |
|---------|----------|-----|
| **useAnimations** | Micro-animations, enhanced UX | https://useanimations.com/ |
| **Simple Icons** | Brand logos (if not in Tabler) | https://simpleicons.org/ |
| **Iconoir** | Specific style requirements | https://iconoir.com/ |
| **Pixel Art Icons** | Retro/pixel aesthetic ONLY | https://pixelarticons.com/ |
| **IsoIcons** | 3D/isometric style ONLY | https://www.isocons.app/ |
| **Remix Icons** | Fallback comprehensive needs | https://remixicon.com/ |
| **Eva Icons** | PNG format requirements | https://akveo.github.io/eva-icons/ |

## Priority Workflow

1. **ALWAYS** check Lucide first
2. If not found, check Hero Icons
3. For brands only, check Tabler Icons
4. Only use other libraries for specific style needs

## Best Practices

### Do

- Use CDN links or npm packages
- Maintain consistent icon library within a project (prefer Lucide throughout)
- Use framework-specific packages when available
- Always specify icon size using library's size prop or CSS classes
- Include aria-label or title for icon-only buttons
- Use sr-only text for important icon meanings

### Don't

- **NEVER** inline custom SVG code
- **NEVER** create custom icons without explicit user request
- Don't mix multiple icon libraries in the same view
- Don't use icons without proper accessibility labels

## Implementation Examples

### React with Lucide (PREFERRED)

```jsx
import { Search, Menu, X, ChevronDown } from 'lucide-react';

function Navigation() {
  return (
    <nav>
      <button aria-label="Search">
        <Search size={20} />
      </button>
      <button aria-label="Menu">
        <Menu size={24} />
      </button>
    </nav>
  );
}
```

### HTML with CDN

```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="search"></i>
<script>lucide.createIcons();</script>
```

### NEVER Do This

```jsx
// BAD - Custom inline SVG
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="M..." />
</svg>
```

## Accessibility Requirements

- Always include `aria-label` or `title` for icon-only buttons
- Use `sr-only` text for important icon meanings
- Ensure sufficient color contrast
- Consider icon + text combinations for critical actions

```jsx
// Good - Accessible icon button
<button aria-label="Close dialog">
  <X size={20} />
</button>

// Good - Icon with visible text
<button>
  <Save size={16} className="mr-2" />
  Save Changes
</button>
```

## Custom SVG Exception Process

If custom SVG is **EXPLICITLY** requested by user:

1. Confirm existing libraries were checked
2. Document why existing libraries don't meet the need
3. Follow SVG optimization best practices
4. Store custom SVGs in `/assets/icons/custom/` directory
5. Include attribution/license information if applicable

## Notes

- Lucide is the default choice for all projects
- Consistency within a project is more important than having the "perfect" icon
- When in doubt, use Lucide
- Custom SVGs require explicit user approval
