# ahooks - Side Effects & Lifecycle Hooks

## useMount

Run callback once on mount.

**When to use:**
- One-time initialization
- Analytics page view tracking
- Initial data fetch (though prefer TanStack Query)

```tsx
useMount(() => {
  analytics.trackPageView();
});
```

## useUnmount

Run callback on unmount.

**When to use:**
- Cleanup that doesn't fit useEffect pattern
- Logging/analytics on leave
- Saving draft state before unmount

```tsx
useUnmount(() => {
  saveDraft(content);
});
```

## useUnmountedRef

Check if component has unmounted.

**When to use:**
- Preventing state updates after unmount in complex async flows
- Manual async cleanup patterns

```tsx
const unmountedRef = useUnmountedRef();

const handleAsync = async () => {
  const result = await fetchData();
  if (!unmountedRef.current) {
    setData(result);
  }
};
```

## useUpdate

Force component re-render.

**When to use:**
- When using refs for state (rare)
- Integration with non-React state management
- Forcing update after external mutations

```tsx
const update = useUpdate();

externalStore.onChange(() => {
  update(); // Force re-render
});
```

## useUpdateEffect

useEffect that skips the first run (mount).

**When to use:**
- Effects that should only run on updates, not initial mount
- Reacting to prop/state changes only

```tsx
const [count, setCount] = useState(0);

useUpdateEffect(() => {
  // Only runs when count changes, NOT on mount
  console.log('count changed to', count);
}, [count]);
```

## useUpdateLayoutEffect

useLayoutEffect that skips first run.

**When to use:**
- Layout effects on updates only
- DOM measurements that should skip initial render

```tsx
useUpdateLayoutEffect(() => {
  measureAndAdjust();
}, [size]);
```

## useDeepCompareEffect

useEffect with deep comparison of dependencies.

**When to use:**
- When dependencies are objects/arrays that change reference but not value
- Avoiding unnecessary effect runs with complex deps

```tsx
const [filters, setFilters] = useState({ sort: 'date', order: 'asc' });

useDeepCompareEffect(() => {
  // Only runs when filters actually change (deep compare)
  fetchData(filters);
}, [filters]);
```

## useDeepCompareLayoutEffect

useLayoutEffect with deep comparison.

**When to use:**
- Same as useDeepCompareEffect but for layout effects

```tsx
useDeepCompareLayoutEffect(() => {
  adjustLayout(config);
}, [config]);
```

## useIsomorphicLayoutEffect

useLayoutEffect on client, useEffect on server.

**When to use:**
- SSR-safe layout effects
- Code that runs in both SSR and CSR

```tsx
useIsomorphicLayoutEffect(() => {
  // useLayoutEffect in browser, useEffect in SSR
  measureDOM();
}, []);
```

## useTrackedEffect

useEffect that tells you which dependencies changed.

**When to use:**
- Debugging which dependency triggered the effect
- Complex effects with many dependencies

```tsx
useTrackedEffect(
  (changes, previousDeps, currentDeps) => {
    console.log('Changed indices:', changes);
    // changes = [0, 2] means deps[0] and deps[2] changed
  },
  [a, b, c, d]
);
```

## useAsyncEffect

useEffect that supports async functions directly.

**When to use:**
- Async operations in effects
- Cleaner syntax than IIFE pattern

```tsx
useAsyncEffect(async () => {
  const data = await fetchData();
  setData(data);

  return () => {
    // cleanup (also can be async)
  };
}, [id]);
```
