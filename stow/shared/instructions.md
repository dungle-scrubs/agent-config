## ⚠️ CRITICAL: Background Processes

**NEVER use `bash` with `&` to background a process. It WILL hang.**

```bash
# WRONG - will hang forever
bash: npm run dev &

# CORRECT - use bg_bash tool
bg_bash: npm run dev
```

Always use the `bg_bash` tool for:
- Starting servers or daemons
- Long-running builds or tests
- Any process that should run independently

The `bg_bash` tool returns immediately with a task ID. Use `task_output` to check results.

---

## Claude Code Directories

Claude Code uses multiple configuration directories. Always verify which directory applies:

| Directory | Purpose |
|-----------|---------|
| `~/.claude/` | Global user settings, plugins, marketplaces |
| `~/.claude-{project}/` | Project-specific settings (e.g., `~/.claude-fuse/` for fuse) |

**Key files in each:**
- `settings.json` - Enabled plugins, hooks, permissions
- `plugins/cache/` - Cached plugin files (may differ between global and project)
- `plugins/installed_plugins.json` - Plugin installation records

**Common pitfall:** Editing `~/.claude/` when the project uses `~/.claude-{project}/` (or vice versa). Plugin `.mcp.json` files, hooks, and settings are project-scoped.

---

## Dev Server Ports

Projects with explicitly assigned ports (to avoid conflicts):

| Port | Project                | Path                                 |
|------|------------------------|--------------------------------------|
| 3000 | rack-warehouse         | ~/dev/rack-warehouse                    |
| 3000 | rack-warehouse-v4/web  | ~/dev/rack-warehouse-v4/apps/web-legacy |
| 3009 | my-plants/website      | ~/dev/my-plants/apps/website            |
| 3010 | payback/web            | ~/dev/payback/apps/web                  |
| 3011 | my-plants/app-web      | ~/dev/my-plants/apps/app-web            |
| 3012 | my-gut                 | ~/dev/my-gut                            |
| 3013 | my-domains             | ~/dev/my-domains                        |
| 3014 | taxes                  | ~/dev/taxes                             |
| 3015 | images                 | ~/dev/images                            |
| 3016 | my-support/dashboard   | ~/dev/my-support/apps/dashboard         |
| 3017 | my-support/demo        | ~/dev/my-support/apps/demo              |
| 3018 | my-support/widget      | ~/dev/my-support/apps/widget            |
| 3019 | code-hunt/dashboard    | ~/dev/claude-plugins/games/skills/code-hunt |
| 3020 | give-me-more-pi        | ~/dev/give-me-more-pi                        |

When creating new projects that need a specific port, add them here.

## Server Ports (8xxx range)

| Port | Project                | Path                                        |
|------|------------------------|---------------------------------------------|
| 8019 | code-hunt/api          | ~/dev/claude-plugins/games/skills/code-hunt |

## New Projects

When user describes building something new, invoke the `project-scaffold` skill before writing code. Trigger phrases:
- "build me X", "create a project", "start a new project"
- "should I use monorepo", "sqlite vs postgres"
- "what structure for X"

Or user can run `/scaffold` explicitly.

## Communication

- When asked "why" you did or didn't do something, ANSWER THE QUESTION FIRST
- Do not apologize and immediately start doing the action - that's not answering "why"
- Explain your reasoning, the decision you made, and what led to it
- Only after explaining should you take corrective action (if needed)

## Documentation Lookup

- ALWAYS call `mcp__tool-proxy__discover_tools` before using WebSearch or WebFetch for docs
- First check local docs with `docs:search_docs` - use cached docs when available
- When fetching documentation for software tools, libraries, APIs, or services via WebFetch:
  - IMMEDIATELY after fetching, save with `docs:add_doc name="<tool>" url="<url>"`
  - This applies to: package docs (npm, PyPI, crates.io), API references, SDK guides, framework docs
  - This does NOT apply to: search results, news articles, Stack Overflow, Wikipedia, social media
- A PostToolUse hook will remind you after WebFetch - take it seriously
- Never fetch library/tool docs without saving them - the local cache prevents redundant fetches

## MCP Server Policy

- NEVER add MCP servers directly to Claude Code configuration (~/.claude/.claude.json)
- Add MCP servers to the tool-proxy system at ~/dev/ai/mcp/apps/
- Run the indexer after adding new apps: `cd ~/dev/ai/services/tool-proxy && pnpm index`

## Tool Proxy Modes

| Mode | Transport | Secrets | Use case |
|------|-----------|---------|----------|
| `start.sh` | STDIO | Varlock/1Password | Local Claude Code with Touch ID |
| `start-local.sh` | STDIO | env files | Local dev, simpler |
| Docker | HTTP/SSE | `OP_SERVICE_ACCOUNT_TOKEN` | Remote access, orchestrator |

Docker mode (`docker compose up tool-proxy`):
- `TOOL_PROXY_HTTP=1` enables HTTP/SSE on port 3100
- `TOOL_PROXY_MODE`: `local` (all) / `api` (locality=api only) / `remote-cc` (whitelist)
- Don't run Docker alongside local STDIO - they share Neo4j and will conflict

### STDIO vs HTTP/SSE

**STDIO**: Claude Code spawns tool-proxy as child process, communicates via stdin/stdout pipes. Newline-delimited JSON, no network stack. 1:1 relationship per session.

**HTTP/SSE**: Tool-proxy runs as standalone server. Client POSTs requests, server pushes events over persistent SSE connection. Many-to-one, can run remotely. SSE chosen over WebSockets for simplicity (no upgrade handshake, works through proxies).

| Concern | STDIO | HTTP/SSE |
|---------|-------|----------|
| Latency | Lower (no network) | Higher |
| Scaling | 1 process per session | Shared server |
| Remote access | No | Yes |
| Process lifecycle | Tied to Claude Code | Independent |

## Git Output

Format commit lists as tables:

| Commit | Description |
|--------|-------------|
| `abc123` | commit message |

## Code Style

- Fewest lines possible; avoid over-engineering
- Self-documenting code with clear variable names
- Single-purpose files/modules; separate logic from presentation
- Extract repeated logic to private methods, components, or utilities

### Comments

- Comments explain "why" not "what"; document non-obvious logic
- Never remove comments unless removing the associated code
- Update comments when modifying code

### Function Documentation

- All functions require JSDoc-style comments
- Include `@param` for each parameter with type and description
- Include `@returns` with type and description
- Add `@throws` when applicable
- Be proactive: add JSDoc when writing new functions and when modifying existing undocumented functions

## 1Password Credentials with opchain

Use `opchain` to retrieve secrets from 1Password. Never hardcode API keys or credentials.

### Why opchain?
- Dual-token system: separate read/write permissions
- Works with service accounts and personal accounts  
- Integrates with macOS Keychain for token storage
- Validates op:// references in .env.op files

### Usage

```bash
# Read a secret
opchain --read op read "op://Vault/Item/field"

# Example: Get Firecrawl API key
opchain --read op read "op://Services/firecrawl/api-key"

# List secrets defined in .env.op files
opchain secrets list [path]

# Validate all op:// references resolve correctly
opchain secrets check [path]
```

### Common Vaults
- `Services` - API keys for external services (Firecrawl, etc.)
- `Models` - LLM API keys (OpenAI, Anthropic, etc.)
- `Development` - Dev tools (GitHub PAT, Linear, etc.)

### Setup
If opchain isn't configured, run:
```bash
opchain setup
```

This stores read/write tokens in macOS Keychain.

## Environment Variables

- Load credentials from `~/.env/services` and `~/.env/models`
- Use `direnv` (.envrc) to selectively export only needed variables, not entire files
- Alias variables when project naming differs from central file naming
- Validate env vars at runtime using `pydantic-settings` (Python) or `t3-env` (TypeScript)

## OOP Best Practices

### Composition & DI

- Favor composition over inheritance (prefer constructor injection over deep inheritance trees)
- Inject dependencies via constructors or factories
- Avoid service locators or hidden globals

### SOLID Principles

- Always follow SOLID principles

### Domain Modeling

- Use value objects for invariants (e.g., `Email`, `Money`)
- Encapsulate invariants and validation in the model
- Prefer rich domain methods over anemic data structures
- Combat primitive obsession: wrap primitives with validation

### Error Handling

- Create typed error hierarchies with discriminants
- Never throw strings; use `Error` subclasses
- Bubble domain errors, map at boundaries (HTTP/UI)

### Patterns

- Tell, Don't Ask: call behavior methods directly, don't inspect then mutate
- Law of Demeter: interact only with immediate collaborators, avoid long call chains
- Make impossible states impossible: encode valid states in types (discriminated unions)
- Replace conditionals with polymorphism: use Strategy pattern over if/else chains
- Fail fast: use guard clauses for preconditions
- Observers & Events: decouple publishers from subscribers

### Testing

- Design for testability: use constructor DI so test doubles can be injected without mocking frameworks
- Test public behavior, not private implementation
- Mock at architectural boundaries; avoid over-mocking internals

### Heuristics

- Use inheritance only for true is-a relationships
- Permit minimal getters when necessary; encapsulate decisions in methods
- If strict adherence impairs clarity, annotate exceptions with rationale
