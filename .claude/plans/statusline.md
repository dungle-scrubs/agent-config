# Custom Status Line Implementation

## Goal
Replace ccline with a custom status line script that includes real-time tool-proxy connection status.

## Target Output
```
🚀 Opus 4.5 | 📁 claude-config | 󰊢 main ● | 󰪞 23.5% · 47.1k | 🔧 ✓
```

## Segments (implement in order)

### 1. Model
- Input: `model.display_name` from stdin JSON
- Output: `🚀 Opus 4.5` (orange)
- Color: c256=208

### 2. Folder
- Input: `cwd` from stdin JSON, extract basename
- Output: `📁 claude-config` (yellow-green)
- Color: c256=142

### 3. Git Branch + Status
- Input: Run `git` commands
- Output: `󰊢 main ●` (teal, ● if dirty)
- Color: c256=109
- Commands: `git branch --show-current`, `git status --porcelain`

### 4. Context Window %
- Input: `contextWindow.current` / `contextWindow.total`
- Output: `󰪞 23.5%` (purple)
- Color: c256=5

### 5. Context Window Tokens
- Input: `contextWindow.current`
- Output: `47.1k` (same color as %)
- Combined with #4: `󰪞 23.5% · 47.1k`

### 6. Tool-Proxy Connection
- Input: Read `/tmp/tool-proxy-state.json`
- States:
  - `connecting` → `🔧 ⏳` (yellow)
  - `connected` → `🔧 ✓` (green)
  - `error` → `🔧 ✗` (red)
  - missing/stale → `🔧 ?` (gray)
- Stale threshold: 60s since last timestamp

## Files to Create/Modify

All status line files live in `~/dev/claude-config/stow/` and get symlinked to `~/.claude/` via `./install.sh`.

### New Files
- `~/dev/claude-config/stow/statusline/status.sh` → `~/.claude/statusline/status.sh`

### Modify
- `~/dev/claude-config/stow/settings.json` → `~/.claude/settings.json`
- `~/dev/tool-proxy/service/src/index.ts` - Add state file writing

## Tool-Proxy State File Changes

Add to `/Users/kevin/dev/tool-proxy/service/src/index.ts`:

```typescript
const STATE_FILE = '/tmp/tool-proxy-state.json';

function writeState(state: 'connecting' | 'connected' | 'error' | 'disconnected', error?: string) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    state,
    pid: process.pid,
    timestamp: Date.now(),
    error
  }));
}
```

Call points:
- Before `verifyNeo4jConnection()` → `writeState('connecting')`
- After `server.connect(transport)` → `writeState('connected')`
- In catch blocks → `writeState('error', err.message)`
- In `gracefulShutdown()` → `writeState('disconnected')`

## Implementation Order

1. Create `stow/statusline/status.sh` with segment 1 (model only)
2. Update `stow/settings.json` to use new script
3. Test, then add segment 2
4. Test, then add segment 3
5. Test, then add segments 4+5
6. Add state file writing to tool-proxy
7. Add segment 6 to status script
8. Test full integration
