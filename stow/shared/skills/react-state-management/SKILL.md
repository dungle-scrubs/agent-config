---
name: react-state-management
description: "React state hierarchy - useState (local), TanStack Query (server), Zustand (global), URL params (shareable). Triggers: state management, data fetching, caching, global state, Zustand, TanStack Query."
---

# React State Management

## When to Use This Skill

This skill should be triggered when:

- Choosing between state management approaches
- Setting up data fetching with TanStack Query
- Implementing global state with Zustand
- Making state shareable via URL parameters
- Integrating React with non-React code via events
- Discussing caching, synchronization, or persistence

## Core Capabilities

1. **State Solution Selection**: Guide selection based on use case hierarchy
2. **TanStack Query**: Server state, caching, background sync, optimistic updates
3. **Zustand**: Lightweight global state with TypeScript and middleware
4. **URL Parameters**: Shareable, bookmarkable state with ahooks
5. **Custom Events**: Cross-framework pub/sub communication

## State Management Decision Hierarchy

### Start Simple, Scale When Needed

1. **useState** - Start here for isolated component state
2. **Context API** - When props drilling becomes painful (3+ levels)
3. **TanStack Query** - When fetching data from APIs
4. **URL params** - When state should be shareable/bookmarkable
5. **Zustand** - When Context becomes complex or performance matters
6. **Custom Events** - When integrating with non-React code

### Quick Decision Guide

| Approach | Best For | Use When |
|----------|----------|----------|
| **TanStack Query** | Server state, API data | Managing async data, caching, synchronization |
| **Zustand** | Global client state | Simplicity with good DX and TypeScript support |
| **URL Params** | Shareable state, filters | State should persist in URL for sharing/bookmarking |
| **Custom Events** | Cross-framework communication | Integrating React with non-React code or plugins |

## TanStack Query (Server State)

### Setup

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          gcTime: 1000 * 60 * 10,   // 10 minutes
          retry: 3,
          refetchOnWindowFocus: true,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Basic Query

```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  enabled: !!userId,
});
```

### Mutation with Cache Update

```typescript
const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['user', user.id] });
  },
});
```

### Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos', newTodo.id] });
    const previousTodo = queryClient.getQueryData(['todos', newTodo.id]);
    queryClient.setQueryData(['todos', newTodo.id], newTodo);
    return { previousTodo };
  },
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todos', newTodo.id], context.previousTodo);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

### Query Key Conventions

```typescript
// Hierarchical and consistent
['todos']
['todos', todoId]
['todos', 'user', userId]
['todos', { status: 'completed', userId }]
```

## Zustand (Global Client State)

### Basic Store

```typescript
import { create } from 'zustand';

interface BearStore {
  bears: number;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  decrease: () => set((state) => ({ bears: state.bears - 1 })),
  reset: () => set({ bears: 0 }),
}));
```

### Use Selectors (Critical for Performance)

```typescript
// BAD: Re-renders on any store change
const store = useBearStore();

// GOOD: Only re-renders when bears changes
const bears = useBearStore((state) => state.bears);

// GOOD: Multiple values with shallow comparison
import { shallow } from 'zustand/shallow';
const { bears, increase } = useBearStore(
  (state) => ({ bears: state.bears, increase: state.increase }),
  shallow
);
```

### Persist Middleware

```typescript
import { persist } from 'zustand/middleware';

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
```

### Immer for Nested Updates

```typescript
import { immer } from 'zustand/middleware/immer';

const useStore = create<NestedStore>()(
  immer((set) => ({
    users: {},
    updateUserName: (id, name) =>
      set((state) => {
        state.users[id].name = name;
      }),
  }))
);
```

### Testing Zustand

```typescript
beforeEach(() => {
  useBearStore.setState({ bears: 0 });
});
```

## URL Parameters (Shareable State)

### With ahooks useUrlState

```typescript
import useUrlState from '@ahooksjs/use-url-state';

function SearchPage() {
  const [filters, setFilters] = useUrlState({
    query: '',
    category: 'all',
    sort: 'relevance',
    page: '1'
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters({
      ...filters,
      [key]: value,
      page: '1'  // Reset page on filter change
    });
  };
}
```

### Debounced URL Updates

```typescript
import { useDebounceFn } from 'ahooks';

function SearchWithDebounce() {
  const [urlState, setUrlState] = useUrlState({ q: '' });
  const [localQuery, setLocalQuery] = useState(urlState.q);

  const { run: updateUrl } = useDebounceFn(
    (value: string) => setUrlState({ q: value }),
    { wait: 500 }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
    updateUrl(e.target.value);
  };
}
```

### When to Use URL State

**Use for:**
- Search filters and sorting
- Pagination
- Tab selections
- Multi-step form wizards
- View configurations

**Avoid for:**
- Sensitive data (tokens, passwords)
- Large data structures
- Temporary UI states (hover, focus)
- High-frequency updates

## Custom Events (Cross-Framework Communication)

### Type-Safe Event System

```typescript
interface CustomEventMap {
  'user:login': { userId: string; username: string };
  'cart:update': { items: CartItem[]; total: number };
  'theme:change': { theme: 'light' | 'dark' };
}

function emitEvent<K extends keyof CustomEventMap>(
  eventName: K,
  detail: CustomEventMap[K]
) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function useTypedEvent<K extends keyof CustomEventMap>(
  eventName: K,
  handler: (detail: CustomEventMap[K]) => void
) {
  useEffect(() => {
    const wrappedHandler = (e: CustomEvent) => handler(e.detail);
    document.addEventListener(eventName, wrappedHandler as EventListener);
    return () => document.removeEventListener(eventName, wrappedHandler as EventListener);
  }, [eventName, handler]);
}
```

### Event Naming Convention

Use namespaced event names: `domain:action`
- `user:login`, `cart:update`, `modal:open`
- NOT `login`, `update`, `open`

### When to Use Custom Events

**Use for:**
- React ↔ vanilla JS communication
- Micro-frontend architectures
- Plugin systems
- Legacy system integration

**Avoid for:**
- Parent-child communication (use props)
- Simple state sharing (use Context or Zustand)

## Hybrid Pattern Example

```typescript
// TanStack Query for server data
const { data: products } = useQuery({
  queryKey: ['products', category],
  queryFn: fetchProducts,
});

// URL params for filters (shareable)
const [searchParams] = useSearchParams();
const category = searchParams.get('category');

// Zustand for cart (client-side)
const cart = useCartStore(state => state.items);

// Custom events for third-party integration
useCustomEvent('analytics:track', trackEvent);
```

## Performance Considerations

| Approach | Re-render Behavior | Optimization Strategy |
|----------|-------------------|----------------------|
| TanStack Query | Smart re-renders with cache | Use select transform, staleTime config |
| Zustand | Only subscribed components | Use selectors, shallow comparison |
| URL Params | Route-level updates | Debounce updates, batch changes |
| Custom Events | Manual subscription | Event delegation, cleanup listeners |

## Best Practices Summary

1. **Start with built-in React state** - Don't over-engineer
2. **Use URL for shareable state** - Filters, pagination, tabs
3. **Choose Zustand for global state** - Simpler than Redux, faster than Context
4. **Reserve custom events for integration** - Not for general React communication
5. **Combine approaches thoughtfully** - Each has its sweet spot
6. **Document your patterns** - Team consistency matters

## Notes

- TanStack Query is for server state (async, external)
- Zustand is for client state (sync, local)
- URL params make state shareable and bookmarkable
- Custom events decouple React from non-React code
- Always clean up event listeners to prevent memory leaks
- Use selectors in Zustand to prevent unnecessary re-renders
