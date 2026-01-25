# ahooks - DOM & Interaction Hooks

## useClickAway

Detect clicks outside of target element(s).

**When to use:**
- Close dropdown/modal when clicking outside
- Dismiss popover on outside click
- Deselect on click away

```tsx
const ref = useRef(null);
useClickAway(() => {
  setOpen(false);
}, ref);

<div ref={ref}>Dropdown content</div>
```

## useHover

Track hover state of an element.

**When to use:**
- Show/hide elements on hover
- Hover-triggered tooltips
- Hover animations

```tsx
const [isHovering, hoverRef] = useHover();

<div ref={hoverRef}>
  {isHovering ? 'Hovering!' : 'Hover me'}
</div>
```

## useFocusWithin

Track if focus is within an element or its descendants.

**When to use:**
- Form field group highlighting
- Focus-based UI state
- Accessibility focus management

```tsx
const [isFocusWithin, focusRef] = useFocusWithin({
  onFocus: () => console.log('focused'),
  onBlur: () => console.log('blurred'),
});

<div ref={focusRef}>
  <input />
  <button />
</div>
```

## useLongPress

Detect long press gestures.

**When to use:**
- Mobile context menus
- Drag initiation
- Hold-to-confirm actions

```tsx
const longPressRef = useLongPress(() => {
  showContextMenu();
}, { delay: 500 });

<button ref={longPressRef}>Long press me</button>
```

## useEventListener

Add event listener with automatic cleanup.

**When to use:**
- Window/document events
- Custom event handling
- Third-party library integration

```tsx
useEventListener('resize', () => {
  setWidth(window.innerWidth);
});

// Or on a specific element
useEventListener('scroll', handleScroll, { target: containerRef });
```

## useKeyPress

Detect keyboard key presses.

**When to use:**
- Keyboard shortcuts
- Form submission on Enter
- Navigation with arrow keys

```tsx
// Single key
useKeyPress('Enter', () => submit());

// Multiple keys
useKeyPress(['ArrowUp', 'ArrowDown'], (event) => {
  if (event.key === 'ArrowUp') moveUp();
  else moveDown();
});

// Key combinations
useKeyPress(['ctrl.s', 'meta.s'], (e) => {
  e.preventDefault();
  save();
});
```

## useMouse

Track mouse position.

**When to use:**
- Custom cursors
- Parallax effects
- Mouse-following elements

```tsx
const mouse = useMouse();

<div style={{
  position: 'fixed',
  left: mouse.clientX,
  top: mouse.clientY,
}}>
  Following mouse
</div>
```

## useScroll

Track scroll position of an element or window.

**When to use:**
- Scroll-based animations
- Infinite scroll triggers
- "Back to top" button visibility

```tsx
const scroll = useScroll(document);

// scroll.top, scroll.left, scroll.direction
{scroll.top > 100 && <BackToTop />}
```

## useSize

Track element dimensions.

**When to use:**
- Responsive components
- Canvas/chart sizing
- Dynamic layouts

```tsx
const [size, sizeRef] = useSize();

<div ref={sizeRef}>
  Width: {size?.width}, Height: {size?.height}
</div>
```

## useInViewport

Detect if element is in viewport.

**When to use:**
- Lazy loading images/components
- Scroll-triggered animations
- Infinite scroll

```tsx
const [inViewport, inViewportRef] = useInViewport({
  threshold: 0.5, // 50% visible
});

<div ref={inViewportRef}>
  {inViewport ? 'Visible!' : 'Not visible'}
</div>
```

## useDrag

Make elements draggable.

**When to use:**
- Drag and drop interfaces
- Reorderable lists
- Custom drag interactions

```tsx
const [props, { dragging }] = useDrag({
  onDragStart: (e) => console.log('started'),
  onDragEnd: (e) => console.log('ended'),
});

<div {...props} style={{ opacity: dragging ? 0.5 : 1 }}>
  Drag me
</div>
```

## useDrop

Create drop targets.

**When to use:**
- File drop zones
- Drag and drop receivers
- Reorderable containers

```tsx
const [props, { isHovering }] = useDrop({
  onDom: (content, e) => handleDrop(content),
  onFiles: (files, e) => handleFiles(files),
  onText: (text, e) => handleText(text),
});

<div {...props} className={isHovering ? 'drop-active' : ''}>
  Drop here
</div>
```

## useEventTarget

Manage input value with target.value pattern.

**When to use:**
- Simple controlled inputs
- When you just need the value, not the event

```tsx
const [value, { onChange, reset }] = useEventTarget({ initialValue: '' });

<input value={value} onChange={onChange} />
<button onClick={reset}>Clear</button>
```

## useTextSelection

Track text selection in the document.

**When to use:**
- Selection-based toolbars (like Medium)
- Copy/highlight functionality
- Annotation tools

```tsx
const selection = useTextSelection();

{selection?.text && (
  <Toolbar style={{ top: selection.top, left: selection.left }}>
    Selected: {selection.text}
  </Toolbar>
)}
```

## useMutationObserver

Watch for DOM mutations.

**When to use:**
- Third-party content changes
- Dynamic content monitoring
- DOM-based analytics

```tsx
useMutationObserver(
  (mutations) => {
    console.log('DOM changed', mutations);
  },
  targetRef,
  { childList: true, subtree: true }
);
```
