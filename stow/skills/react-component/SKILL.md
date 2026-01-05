---
name: react-component
description: React component development with Radix composition patterns and shadcn/ui. Triggers: React components, component architecture, forms, modals, data tables, building UI.
---

# React Component Development

## When to Use This Skill

This skill should be triggered when:

- Creating or modifying React components
- Discussing component architecture or patterns
- Selecting component libraries (shadcn/ui, ReactBits, Animate UI)
- Building forms, modals, data tables, or complex UI
- Implementing compound components or composition patterns
- Working with controlled/uncontrolled state patterns

## Core Capabilities

1. **Component Library Selection**: Guide selection between shadcn/ui (default), ReactBits (creative), and Animate UI (animated)
2. **Composition Patterns**: Implement Radix-style compound components with proper context and forwardRef
3. **Form Architecture**: Build accessible forms with react-hook-form integration
4. **State Management**: Apply controlled/uncontrolled patterns with useControllableState

## Component Library Hierarchy

### shadcn/ui (Default Choice - No Prompting Required)

Use freely for ALL standard UI patterns:

- Forms: button, input, checkbox, radio, select, switch, textarea
- Navigation: breadcrumb, navigation-menu, pagination, tabs
- Layout: accordion, card, separator, carousel, sheet
- Feedback: alert, alert-dialog, dialog, toast, progress, skeleton
- Data: table, data-table, avatar, badge, label
- Overlay: popover, tooltip, dropdown-menu, command

```bash
pnpm dlx shadcn@latest add [component-name]
```

### ReactBits (Creative Projects - ALWAYS Prompt First)

Only for projects requiring creative visual effects:

- Marketing sites, portfolios, hero sections
- High-impact UI moments where flair enhances UX
- 107 components: TextAnimations, Animations, Components, Backgrounds

**ALWAYS ask**: "Would you like me to use [component] from ReactBits for [use case]?"

```bash
npx jsrepo add [component-name]
```

### Animate UI (Functional Animation - ALWAYS Prompt First)

For sophisticated functional animations:

- Dashboards, admin panels, professional interfaces
- Real-time or collaborative applications

```bash
npx animate-ui-cli add [component-name]
```

## Composition Patterns

### Compound Component Structure

```tsx
// Root component - manages state and context
const ComponentRoot = React.forwardRef<HTMLDivElement, ComponentRootProps>(
  ({ children, defaultValue, value, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = useControllableState({
      prop: value,
      defaultProp: defaultValue,
      onChange: onValueChange,
    });

    return (
      <ComponentProvider value={{ value: internalValue, onValueChange: setInternalValue }}>
        <div ref={ref} data-state={getState(internalValue)} {...props}>
          {children}
        </div>
      </ComponentProvider>
    );
  }
);
ComponentRoot.displayName = 'Component.Root';

// Export as namespace
export const Component = {
  Root: ComponentRoot,
  Trigger: ComponentTrigger,
  Content: ComponentContent,
};
```

### Context Pattern with Error Boundary

```tsx
function createContext<T>(rootComponentName: string) {
  const Context = React.createContext<T | undefined>(undefined);

  function useContext(consumerName: string) {
    const context = React.useContext(Context);
    if (!context) {
      throw new Error(
        `\`${consumerName}\` must be used within \`${rootComponentName}\``
      );
    }
    return context;
  }

  return [Context.Provider, useContext] as const;
}
```

### Controllable State Hook

```tsx
function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop?: T;
  defaultProp?: T;
  onChange?: (value: T) => void;
}) {
  const [uncontrolledProp, setUncontrolledProp] = useState(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolledProp;

  const handleChange = useCallback((nextValue: T) => {
    if (!isControlled) {
      setUncontrolledProp(nextValue);
    }
    onChange?.(nextValue);
  }, [isControlled, onChange]);

  return [value, handleChange] as const;
}
```

### asChild Pattern (Slot)

```tsx
interface ComponentProps {
  asChild?: boolean;
  children: React.ReactNode;
}

const Component = React.forwardRef<HTMLButtonElement, ComponentProps>(
  ({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} {...props} />;
  }
);

// Usage - render as Link instead of button
<Component asChild>
  <Link href="/home">Home</Link>
</Component>
```

## Props Conventions

### Common Props Pattern

```tsx
interface CommonProps {
  // Styling
  className?: string;
  style?: React.CSSProperties;

  // Accessibility
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;

  // Behavior
  disabled?: boolean;
  required?: boolean;

  // Data attributes for styling states
  'data-state'?: 'open' | 'closed' | 'active' | 'inactive';
  'data-disabled'?: boolean;
}
```

### Controlled vs Uncontrolled

```tsx
interface ControlledProps<T> {
  // Uncontrolled
  defaultValue?: T;

  // Controlled
  value?: T;
  onValueChange?: (value: T) => void;
}
```

## Event Handling

```tsx
function composeEventHandlers<E>(
  originalEventHandler?: (event: E) => void,
  ourEventHandler?: (event: E) => void,
  { checkForDefaultPrevented = true } = {}
) {
  return function handleEvent(event: E) {
    originalEventHandler?.(event);
    if (checkForDefaultPrevented === false || !(event as any).defaultPrevented) {
      ourEventHandler?.(event);
    }
  };
}
```

## File Naming Convention

- Components: kebab-case (e.g., `user-profile.tsx`, `data-table.tsx`)
- Hooks: kebab-case with use- prefix (e.g., `use-controllable-state.ts`)
- Utils: kebab-case (e.g., `compose-event-handlers.ts`)

## Best Practices

### Type Safety

- Use TypeScript for all components
- Export prop types for each component
- Use discriminated unions for variant props

### Performance

- Use React.memo for expensive child components
- Implement proper key strategies for lists
- Use useCallback and useMemo appropriately

### Accessibility

- ARIA attributes baked in by default
- Keyboard navigation support
- Screen reader compatibility
- Focus management with useFocusScope

### Testing

- Test behavior, not implementation
- Focus on user interactions
- Test accessibility features

## Integration with Hooks

Use these hooks from ahooks and custom patterns:

- **useControllableValue** - For controlled/uncontrolled state
- **useMeasure** (react-use-measure) - For measuring portal content
- **useBoolean** - For simple open/closed states
- **useOnClickOutside** - For dismissing overlays

## Example: Complete Compound Component

```tsx
// Dialog.tsx
const [DialogProvider, useDialogContext] = createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>('Dialog');

export const Root = ({ children, open, defaultOpen = false, onOpenChange }: RootProps) => {
  const [isOpen, setIsOpen] = useControllableState({
    prop: open,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <DialogProvider value={{ open: isOpen, onOpenChange: setIsOpen }}>
      {children}
    </DialogProvider>
  );
};

export const Trigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ asChild, ...props }, ref) => {
    const context = useDialogContext('Dialog.Trigger');
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        aria-haspopup="dialog"
        aria-expanded={context.open}
        data-state={context.open ? 'open' : 'closed'}
        onClick={composeEventHandlers(props.onClick, () => {
          context.onOpenChange(true);
        })}
        {...props}
      />
    );
  }
);

export const Dialog = { Root, Trigger, Portal, Overlay, Content };
```

## Notes

- shadcn/ui is ALWAYS the default choice - no need to ask
- ReactBits and Animate UI require user confirmation before use
- Follow Radix-style patterns for custom compound components
- Maintain accessibility as a first-class concern
- Use data-state attributes for CSS-based state styling
