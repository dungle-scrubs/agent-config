# ahooks - Advanced Hooks

## useVirtualList

Virtualize long lists for performance.

**When to use:**
- Lists with 100+ items
- Performance issues with long lists
- Infinite scroll implementations

```tsx
const [list, scrollTo] = useVirtualList(originalList, {
  containerTarget: containerRef,
  wrapperTarget: wrapperRef,
  itemHeight: 50,
  overscan: 5,
});

<div ref={containerRef} style={{ height: 300, overflow: 'auto' }}>
  <div ref={wrapperRef}>
    {list.map(({ data, index }) => (
      <div key={index} style={{ height: 50 }}>
        {data.name}
      </div>
    ))}
  </div>
</div>
```

## useSelections

Manage selection state for lists.

**When to use:**
- Multi-select lists
- Checkbox tables
- Batch operations UI

```tsx
const {
  selected,
  allSelected,
  noneSelected,
  partiallySelected,
  isSelected,
  toggle,
  toggleAll,
  select,
  unSelect,
  setSelected,
} = useSelections(items, { defaultSelected: [] });

<input
  type="checkbox"
  checked={allSelected}
  onChange={toggleAll}
  indeterminate={partiallySelected}
/>

{items.map(item => (
  <input
    type="checkbox"
    checked={isSelected(item)}
    onChange={() => toggle(item)}
  />
))}
```

## useHistoryTravel

Undo/redo state management.

**When to use:**
- Text editors with undo
- Drawing applications
- Multi-step forms with back support

```tsx
const {
  value,
  setValue,
  back,
  forward,
  go,
  canBack,
  canForward,
  backLength,
  forwardLength,
} = useHistoryTravel({ x: 0, y: 0 });

<button onClick={back} disabled={!canBack}>Undo</button>
<button onClick={forward} disabled={!canForward}>Redo</button>
```

## useDynamicList

Manage dynamic list with add/remove/move operations.

**When to use:**
- Form field arrays
- Dynamic input lists
- Reorderable lists

```tsx
const { list, push, remove, replace, insert, move, getKey } = useDynamicList([
  { name: '' },
]);

{list.map((item, index) => (
  <div key={getKey(index)}>
    <input
      value={item.name}
      onChange={(e) => replace(index, { name: e.target.value })}
    />
    <button onClick={() => remove(index)}>Remove</button>
  </div>
))}
<button onClick={() => push({ name: '' })}>Add</button>
```

## useControllableValue

Make components work in both controlled and uncontrolled mode.

**When to use:**
- Building reusable form components
- Components that accept optional value/onChange

```tsx
function CustomInput(props) {
  const [value, setValue] = useControllableValue(props, {
    defaultValue: '',
  });

  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}

// Works as uncontrolled
<CustomInput defaultValue="initial" />

// Works as controlled
<CustomInput value={text} onChange={setText} />
```

## useInfiniteScroll

Infinite scroll data loading.

**When to use:**
- Paginated lists with scroll loading
- Feed-style content
- Endless scrolling galleries

```tsx
const { data, loading, loadingMore, noMore } = useInfiniteScroll(
  async (d) => {
    const list = await fetchPage(d?.nextPage || 1);
    return {
      list,
      nextPage: d?.nextPage ? d.nextPage + 1 : 2,
    };
  },
  {
    target: containerRef,
    isNoMore: (d) => d?.list.length >= totalCount,
  }
);
```

## usePagination

Pagination state management.

**When to use:**
- Paginated tables
- API pagination
- Page navigation

```tsx
const { data, loading, pagination } = usePagination(
  ({ current, pageSize }) => fetchUsers({ page: current, size: pageSize }),
  {
    defaultPageSize: 20,
  }
);

<Table data={data?.list} loading={loading} />
<Pagination
  current={pagination.current}
  total={pagination.total}
  onChange={pagination.changeCurrent}
/>
```

## useWhyDidYouUpdate

Debug unnecessary re-renders.

**When to use:**
- Performance debugging
- Finding prop changes causing re-renders
- Development only

```tsx
function MyComponent(props) {
  useWhyDidYouUpdate('MyComponent', props);
  // Logs which props changed and their old/new values
  return <div>...</div>;
}
```

## useEventEmitter

Pub/sub event system within React.

**When to use:**
- Cross-component communication
- Decoupled event handling
- Complex component hierarchies

```tsx
// Create emitter (usually in context)
const event$ = useEventEmitter<string>();

// Subscribe
event$.useSubscription((val) => {
  console.log('received:', val);
});

// Emit
event$.emit('hello');
```
