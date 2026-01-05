# ahooks - Timing & Performance Hooks

## useDebounce

Debounce a value - delays updating until after wait period of inactivity.

**When to use:**
- Search input that triggers API calls
- Form validation on change
- Any rapidly changing value that triggers expensive operations

```tsx
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, { wait: 300 });

useEffect(() => {
  // Only fires 300ms after user stops typing
  searchApi(debouncedSearch);
}, [debouncedSearch]);
```

## useDebounceFn

Debounce a function instead of a value.

**When to use:**
- Event handlers that shouldn't fire too frequently
- Resize/scroll handlers
- API calls triggered by user actions

```tsx
const { run: debouncedSave } = useDebounceFn(
  (value) => saveToServer(value),
  { wait: 500 }
);

<input onChange={(e) => debouncedSave(e.target.value)} />
```

## useDebounceEffect

Debounced useEffect - effect only runs after dependencies stabilize.

**When to use:**
- Effects that depend on rapidly changing values
- Avoiding multiple effect runs during rapid updates

```tsx
useDebounceEffect(
  () => {
    // Only runs 500ms after searchTerm stops changing
    fetchResults(searchTerm);
  },
  [searchTerm],
  { wait: 500 }
);
```

## useThrottle

Throttle a value - updates at most once per wait period.

**When to use:**
- Progress indicators
- Live preview that shouldn't update too frequently
- Rate-limited displays

```tsx
const [position, setPosition] = useState(0);
const throttledPosition = useThrottle(position, { wait: 100 });

// throttledPosition updates at most every 100ms
```

## useThrottleFn

Throttle a function.

**When to use:**
- Scroll handlers
- Mouse move handlers
- Any high-frequency event that needs rate limiting

```tsx
const { run: throttledScroll } = useThrottleFn(
  () => updateScrollPosition(),
  { wait: 100 }
);

window.addEventListener('scroll', throttledScroll);
```

## useThrottleEffect

Throttled useEffect.

**When to use:**
- Effects triggered by high-frequency state changes
- Animation frame-based updates

```tsx
useThrottleEffect(
  () => {
    updateVisualization(data);
  },
  [data],
  { wait: 16 } // ~60fps
);
```

## useInterval

setInterval with automatic cleanup and dynamic delay.

**When to use:**
- Polling
- Timers/countdowns
- Auto-refresh functionality

```tsx
const [count, setCount] = useState(0);

// Pass null to pause the interval
useInterval(() => {
  setCount(count + 1);
}, 1000);
```

## useTimeout

setTimeout with automatic cleanup.

**When to use:**
- Delayed actions
- Toast/notification auto-dismiss
- Delayed redirects

```tsx
useTimeout(() => {
  showWelcomeMessage();
}, 2000);
```

## useCountDown

Countdown timer with formatting.

**When to use:**
- Sale countdown timers
- Session expiry warnings
- Time-limited actions

```tsx
const [countdown, { days, hours, minutes, seconds }] = useCountDown({
  targetDate: '2024-12-31 23:59:59',
});

// Or with leftTime in ms
const [countdown] = useCountDown({
  leftTime: 60 * 1000, // 60 seconds
  onEnd: () => alert('Time up!'),
});
```

## useRafInterval

setInterval using requestAnimationFrame for smoother animations.

**When to use:**
- Animation loops
- Smooth visual updates
- When 60fps timing matters

```tsx
useRafInterval(() => {
  updateAnimation();
}, 16); // ~60fps
```

## useRafTimeout

setTimeout using requestAnimationFrame.

**When to use:**
- Delayed animations
- Visual transitions

```tsx
useRafTimeout(() => {
  startAnimation();
}, 100);
```

## useRafState

State that only updates on animation frames.

**When to use:**
- High-frequency state updates (mouse position, scroll)
- Preventing too many re-renders

```tsx
const [position, setPosition] = useRafState({ x: 0, y: 0 });

// Updates batched to animation frames
onMouseMove={(e) => setPosition({ x: e.clientX, y: e.clientY })}
```

## useLockFn

Prevent concurrent execution of async functions.

**When to use:**
- Prevent double-submit on buttons
- Ensure only one API call at a time
- Sequential async operations

```tsx
const { run: submit } = useLockFn(async () => {
  await saveData();
  // Button is disabled while this runs
});

<button onClick={submit} disabled={loading}>Submit</button>
```

## useMemoizedFn

Memoize a function with stable reference.

**When to use:**
- Callbacks passed to optimized children
- Event handlers that shouldn't trigger re-renders
- Avoiding useCallback dependency arrays

```tsx
// fn reference never changes, but always calls latest implementation
const handleClick = useMemoizedFn((id) => {
  doSomething(id, currentState);
});
```

## useLatest

Get a ref that always points to latest value.

**When to use:**
- Accessing current state in callbacks without stale closure
- Event handlers that need current values

```tsx
const [count, setCount] = useState(0);
const latestCount = useLatest(count);

const handleClick = () => {
  setTimeout(() => {
    console.log(latestCount.current); // Always current value
  }, 3000);
};
```

## useCreation

useMemo alternative that guarantees the factory only runs once.

**When to use:**
- Creating expensive objects that should only be created once
- When useMemo's "semantic guarantee" isn't strong enough

```tsx
const instance = useCreation(() => new ExpensiveClass(), []);
```
