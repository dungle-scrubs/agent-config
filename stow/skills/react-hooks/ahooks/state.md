# ahooks - State Management Hooks

## useBoolean

Elegant boolean state management with toggle, set true, and set false actions.

**When to use:**
- Modal open/close state
- Sidebar expanded/collapsed
- Any true/false toggle UI

```tsx
const [isOpen, { toggle, setTrue, setFalse }] = useBoolean(false);

<button onClick={toggle}>Toggle</button>
<button onClick={setTrue}>Open</button>
<button onClick={setFalse}>Close</button>
```

## useToggle

Toggle between two values (not just boolean).

**When to use:**
- Switch between 'grid' and 'list' view
- Toggle between 'light' and 'dark' theme
- Any two-state value

```tsx
const [view, { toggle, set }] = useToggle('grid', 'list');

<button onClick={toggle}>{view}</button>
```

## useCounter

Number state with increment, decrement, set, and reset.

**When to use:**
- Quantity selectors
- Pagination current page
- Step counters

```tsx
const [count, { inc, dec, set, reset }] = useCounter(0, { min: 0, max: 10 });

<button onClick={() => dec()}>-</button>
<span>{count}</span>
<button onClick={() => inc()}>+</button>
```

## useSetState

Merge-style state updates like class component setState.

**When to use:**
- Form state with multiple fields
- Complex object state
- When you want partial updates without spreading

```tsx
const [state, setState] = useSetState({ name: '', email: '', age: 0 });

// Partial update - only updates name, keeps email and age
setState({ name: 'Kevin' });
```

## useResetState

State with reset to initial value.

**When to use:**
- Form reset functionality
- Resetting filters to defaults
- Any state that needs "restore defaults"

```tsx
const [state, setState, resetState] = useResetState({ filters: [] });

<button onClick={resetState}>Reset Filters</button>
```

## useMap

State management for Map data structure.

**When to use:**
- Key-value data with frequent lookups
- When you need Map methods (has, delete, etc.)
- Caching/memoization patterns

```tsx
const [map, { set, remove, reset, get }] = useMap([['key1', 'value1']]);

set('key2', 'value2');
remove('key1');
const value = get('key2');
```

## useSet

State management for Set data structure.

**When to use:**
- Unique value collections (selected IDs, tags)
- Toggle membership (add if absent, remove if present)
- Deduplication

```tsx
const [set, { add, remove, reset, has }] = useSet(['item1']);

<button onClick={() => has('item1') ? remove('item1') : add('item1')}>
  Toggle item1
</button>
```

## useLocalStorageState

Persist state to localStorage with automatic sync.

**When to use:**
- User preferences that persist across sessions
- Draft content auto-save
- Remember UI state (sidebar collapsed, theme)

```tsx
const [theme, setTheme] = useLocalStorageState('theme', {
  defaultValue: 'light',
});

// Automatically syncs to localStorage
setTheme('dark');
```

## useSessionStorageState

Persist state to sessionStorage (cleared on tab close).

**When to use:**
- Temporary state within a session
- Form progress that shouldn't persist forever
- Tab-specific state

```tsx
const [step, setStep] = useSessionStorageState('wizard-step', {
  defaultValue: 1,
});
```

## useCookieState

State synced with cookies.

**When to use:**
- Cross-subdomain state
- State that needs to be sent with HTTP requests
- Legacy systems requiring cookies

```tsx
const [token, setToken] = useCookieState('auth-token');

setToken('new-token', { expires: 7 }); // expires in 7 days
```

## usePrevious

Track the previous value of a state or prop.

**When to use:**
- Comparing current vs previous for animations
- Detecting direction of change
- Undo functionality

```tsx
const [count, setCount] = useState(0);
const previous = usePrevious(count);

// previous is undefined on first render, then tracks old values
```

## useGetState

useState with a getter function to avoid stale closures.

**When to use:**
- Accessing state inside callbacks/timeouts
- When you hit stale closure issues
- Event handlers that need current state

```tsx
const [count, setCount, getCount] = useGetState(0);

const handleClick = () => {
  setTimeout(() => {
    // getCount() always returns current value, not stale closure
    console.log(getCount());
  }, 3000);
};
```

## useSafeState

useState that ignores updates after unmount.

**When to use:**
- Async operations that may complete after unmount
- Preventing "Can't perform state update on unmounted component"

```tsx
const [data, setData] = useSafeState(null);

useEffect(() => {
  fetchData().then(setData); // Safe even if component unmounts
}, []);
```

## useReactive

Reactive object state (like Vue's reactive).

**When to use:**
- When you prefer mutable-style updates
- Complex nested state
- Porting Vue code to React

```tsx
const state = useReactive({ count: 0, nested: { value: 1 } });

// Direct mutation triggers re-render
state.count++;
state.nested.value = 2;
```
