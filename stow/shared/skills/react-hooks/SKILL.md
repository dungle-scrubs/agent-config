---
description: React hook patterns and ahooks library usage. Apply when working with React/Preact components to identify hook extraction opportunities and recommend ahooks alternatives to manual implementations.
---

# React Hooks - Patterns & ahooks Library

When working with React/Preact components:
1. Identify opportunities for custom hook extraction
2. **Always check if ahooks has a hook** before writing custom implementations

## ahooks - Prefer Over Custom Implementations

[ahooks](https://ahooks.js.org/) is a high-quality React hooks library. Before
writing custom hooks, check if ahooks already provides what you need.

**Exclude**: `useRequest` - use TanStack Query instead for data fetching.

### Quick Reference by Use Case

| Need | ahooks Hook | Instead of |
|------|-------------|------------|
| Boolean state | `useBoolean` | `useState(false)` + toggle fn |
| Toggle between values | `useToggle` | `useState` + manual toggle |
| Counter | `useCounter` | `useState(0)` + inc/dec fns |
| Object state | `useSetState` | `useState({})` + spread merging |
| Map data | `useMap` | `useState(new Map())` |
| Set data | `useSet` | `useState(new Set())` |
| localStorage | `useLocalStorageState` | `useState` + `useEffect` sync |
| sessionStorage | `useSessionStorageState` | `useState` + `useEffect` sync |
| Cookies | `useCookieState` | manual cookie handling |
| Debounce value | `useDebounce` | custom debounce logic |
| Debounce function | `useDebounceFn` | lodash.debounce wrapper |
| Throttle value | `useThrottle` | custom throttle logic |
| Throttle function | `useThrottleFn` | lodash.throttle wrapper |
| Interval | `useInterval` | `setInterval` + cleanup |
| Timeout | `useTimeout` | `setTimeout` + cleanup |
| Previous value | `usePrevious` | useRef pattern |
| Mount callback | `useMount` | `useEffect(() => {}, [])` |
| Unmount callback | `useUnmount` | `useEffect(() => cleanup, [])` |
| Click outside | `useClickAway` | manual event listener |
| Hover state | `useHover` | onMouseEnter/Leave handlers |
| Key press | `useKeyPress` | keyboard event listener |
| Mouse position | `useMouse` | mousemove listener |
| Scroll position | `useScroll` | scroll listener |
| Element size | `useSize` | ResizeObserver |
| In viewport | `useInViewport` | IntersectionObserver |
| Network status | `useNetwork` | navigator.onLine + events |
| Document visibility | `useDocumentVisibility` | visibilitychange event |
| Fullscreen | `useFullscreen` | Fullscreen API |
| Page title | `useTitle` | `document.title = x` |
| Favicon | `useFavicon` | manual link manipulation |
| Lock async fn | `useLockFn` | manual loading state |
| Virtual list | `useVirtualList` | custom virtualization |
| Drag/Drop | `useDrag` / `useDrop` | HTML5 drag events |
| Selections | `useSelections` | manual selection state |
| History travel | `useHistoryTravel` | undo/redo state |
| Mutation observer | `useMutationObserver` | MutationObserver API |
| Text selection | `useTextSelection` | Selection API |
| Responsive | `useResponsive` | media query listeners |
| Deep compare effect | `useDeepCompareEffect` | custom deep comparison |
| RAF timing | `useRafInterval` / `useRafTimeout` | requestAnimationFrame |

**Detailed hook documentation**: `$file: ./ahooks/index.md`

## When to Apply

- Reviewing React/Preact component code
- Creating new components with stateful logic
- Editing existing components
- Code review discussions about React patterns

## Hook Extraction Signals

### Strong Candidates for Custom Hooks

1. **Repeated useState + useEffect pairs**
   - Same state + side effect pattern in multiple components
   - Example: loading state + fetch logic

2. **Complex useEffect with cleanup**
   - Event listeners, subscriptions, timers
   - Example: window resize listener, intersection observer

3. **State machines / multi-step state**
   - Related state variables that change together
   - Example: form state (values, errors, touched, submitting)

4. **Browser API interactions**
   - localStorage, sessionStorage, navigator APIs
   - Example: `useLocalStorage`, `useGeolocation`

5. **Debounced/throttled values**
   - Any value that needs timing control
   - Example: search input, scroll position

6. **Media queries / responsive logic**
   - Breakpoint detection, orientation changes
   - Example: `useMediaQuery`, `useBreakpoint`

### Weak Candidates (Usually Keep Inline)

- Single useState with simple updates
- useEffect that only runs once on mount with no cleanup
- Component-specific logic unlikely to be reused

## Extraction Pattern

```tsx
// Before: Logic scattered in component
function Component() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData().then(setData).catch(setError).finally(() => setLoading(false));
  }, []);

  // ... render
}

// After: Extracted to custom hook
function useAsyncData(fetchFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFn().then(setData).catch(setError).finally(() => setLoading(false));
  }, [fetchFn]);

  return { data, loading, error };
}

function Component() {
  const { data, loading, error } = useAsyncData(fetchData);
  // ... render
}
```

## Naming Conventions

- Prefix with `use`
- Describe what it manages, not how: `useAuth` not `useAuthStateAndEffects`
- Be specific: `useLocalStorage` not `useStorage`

## When Suggesting Hooks

Provide:
1. The pattern you spotted
2. Suggested hook name
3. Brief extraction sketch
4. Reuse potential (how many places could use this?)

Don't:
- Suggest hooks for trivial single-use logic
- Over-abstract stable, simple code
- Force extraction when inline is clearer
