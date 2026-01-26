# ahooks - Browser API Hooks

## useNetwork

Track network connection status.

**When to use:**
- Offline indicators
- Disable actions when offline
- Connection quality indicators

```tsx
const networkState = useNetwork();

// networkState.online, networkState.type, networkState.effectiveType
{!networkState.online && <OfflineBanner />}
```

## useDocumentVisibility

Track document visibility state.

**When to use:**
- Pause videos/animations when tab hidden
- Refresh data when tab becomes visible
- Analytics for active time

```tsx
const visibility = useDocumentVisibility();

useEffect(() => {
  if (visibility === 'visible') {
    refreshData();
  }
}, [visibility]);
```

## useFullscreen

Manage fullscreen state.

**When to use:**
- Video players
- Image galleries
- Presentation mode

```tsx
const [isFullscreen, { enterFullscreen, exitFullscreen, toggleFullscreen }] =
  useFullscreen(targetRef);

<button onClick={toggleFullscreen}>
  {isFullscreen ? 'Exit' : 'Enter'} Fullscreen
</button>
```

## useTitle

Set document title.

**When to use:**
- Dynamic page titles
- Notification counts in title
- Route-based titles

```tsx
useTitle('Dashboard - My App');

// With template
useTitle(`(${unreadCount}) Messages`);
```

## useFavicon

Set document favicon dynamically.

**When to use:**
- Notification indicators
- Status indicators
- Themed favicons

```tsx
useFavicon('/favicon-notification.ico');
```

## useTheme

Manage theme (light/dark mode).

**When to use:**
- Theme switching
- System preference detection

```tsx
const [theme, { setTheme, toggle }] = useTheme({
  localStorageKey: 'theme',
});

<button onClick={toggle}>
  Current: {theme}
</button>
```

## useResponsive

Responsive breakpoint detection.

**When to use:**
- Conditional rendering by screen size
- Responsive component variants
- Layout decisions

```tsx
// Configure once at app root
configResponsive({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
});

// Use in components
const responsive = useResponsive();

{responsive.lg ? <DesktopNav /> : <MobileNav />}
```

## useExternal

Load external scripts/styles dynamically.

**When to use:**
- Third-party SDK loading
- Conditional script loading
- Code splitting for external deps

```tsx
const status = useExternal('https://cdn.example.com/sdk.js', {
  type: 'js',
});

// status: 'loading' | 'ready' | 'error'
{status === 'ready' && <SDKComponent />}
```

## useWebSocket

WebSocket connection management.

**When to use:**
- Real-time data
- Chat applications
- Live updates

```tsx
const { readyState, sendMessage, latestMessage, disconnect, connect } =
  useWebSocket('wss://api.example.com/ws', {
    onOpen: () => console.log('connected'),
    onMessage: (msg) => handleMessage(msg),
    onError: (err) => handleError(err),
    reconnectLimit: 3,
    reconnectInterval: 3000,
  });
```
