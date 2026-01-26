---
name: css
description: Apply CSS best practices using Tailwind CSS v4 with container queries, mobile-first design, and shadcn/ui tokens. Use when writing CSS, styling components, creating responsive layouts, or working with Tailwind configuration.
---

# CSS Best Practices Skill

## When to Use This Skill

This skill should be triggered when:

- Writing or reviewing CSS/Tailwind styles
- Creating responsive layouts or components
- Configuring Tailwind or shadcn/ui theming
- Discussing CSS architecture decisions
- Setting up new projects with styling

## Core Principles

### 1. Tailwind CSS v4 by Default

New projects should always use the latest version of Tailwind CSS (v4). Key v4 features:

- CSS-first configuration using `@theme` directive
- Native CSS variables for all design tokens
- Automatic content detection (no `content` config needed)
- Built-in container queries support

### 2. Container Queries First

Use `@container` queries for component-level responsiveness when possible:

```css
/* Define container */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Respond to container size */
@container card (min-width: 400px) {
  .card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

With Tailwind v4:

```html
<div class="@container">
  <div class="@sm:grid @sm:grid-cols-2">
    <!-- Responds to container, not viewport -->
  </div>
</div>
```

### 3. Media Queries for Viewport Dependencies

Use viewport-based media queries only when responsiveness depends on viewport width:

- Navigation/header layouts
- Full-page layouts
- Elements that must coordinate across the entire viewport

```html
<nav class="flex flex-col md:flex-row">
  <!-- Viewport-dependent navigation -->
</nav>
```

### 4. Mobile-First Approach

Write base styles for mobile, then enhance for larger screens:

```html
<!-- Base (mobile) -> sm -> md -> lg -> xl -> 2xl -->
<div class="text-sm md:text-base lg:text-lg">
  <!-- Progressively enhanced -->
</div>
```

## shadcn/ui Token Structure

### CSS Variables Configuration

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

### Using Tokens in Tailwind

```html
<div class="bg-background text-foreground">
  <button class="bg-primary text-primary-foreground hover:bg-primary/90">
    Primary Action
  </button>
  <p class="text-muted-foreground">Secondary text</p>
</div>
```

## Tailwind v4 Configuration

### CSS-based Config (v4 style)

```css
@import "tailwindcss";

@theme {
  /* Colors */
  --color-primary: oklch(0.7 0.15 250);
  --color-secondary: oklch(0.8 0.1 200);

  /* Spacing */
  --spacing-18: 4.5rem;

  /* Font sizes */
  --font-size-xxs: 0.625rem;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}
```

### Container Query Breakpoints

Tailwind v4 includes container query variants:

- `@xs` - 20rem (320px)
- `@sm` - 24rem (384px)
- `@md` - 28rem (448px)
- `@lg` - 32rem (512px)
- `@xl` - 36rem (576px)
- `@2xl` - 42rem (672px)

## Common Patterns

### Responsive Card with Container Queries

```html
<div class="@container">
  <article class="flex flex-col @md:flex-row gap-4 p-4 bg-card rounded-lg border">
    <img class="w-full @md:w-48 aspect-video object-cover rounded" />
    <div class="flex-1">
      <h3 class="font-semibold text-card-foreground">Title</h3>
      <p class="text-muted-foreground text-sm">Description</p>
    </div>
  </article>
</div>
```

### Responsive Grid

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 gap-4">
    <!-- Grid items -->
  </div>
</div>
```

### Theme-Aware Component

```html
<div class="bg-background text-foreground border-border rounded-[--radius]">
  <h2 class="text-primary">Heading</h2>
  <p class="text-muted-foreground">Supporting text</p>
  <button class="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
    Action
  </button>
</div>
```

## Best Practices Summary

1. **Container queries by default** - Use `@container` for component responsiveness
2. **Media queries sparingly** - Only for true viewport dependencies
3. **Mobile-first** - Base styles for mobile, enhance upward
4. **Use shadcn tokens** - Leverage the semantic color system
5. **Tailwind v4 features** - CSS-first config, native container queries
6. **Semantic colors** - Use `primary`, `secondary`, `muted` over raw colors
7. **Consistent spacing** - Use Tailwind's spacing scale
8. **Dark mode ready** - Always consider both light and dark themes

## Notes

- Container queries provide better component encapsulation than media queries
- shadcn/ui tokens ensure consistent theming across components
- Tailwind v4's CSS-first approach simplifies configuration
- Always test responsive behavior in both container and viewport contexts
