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

When creating new projects that need a specific port, add them here.

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
- Create a new app directory with app.config.json and session script following existing patterns
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

## Code Style

- Fewest lines possible; avoid over-engineering
- Self-documenting code with clear variable names
- Single-purpose files/modules; separate logic from presentation
- Extract repeated logic to private methods, components, or utilities

### Comments

- Comments explain "why" not "what"; document non-obvious logic
- Never remove comments unless removing the associated code
- Update comments when modifying code

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

- Test public behavior, not private implementation
- Mock at architectural boundaries; avoid over-mocking internals

### Heuristics

- Use inheritance only for true is-a relationships
- Permit minimal getters when necessary; encapsulate decisions in methods
- If strict adherence impairs clarity, annotate exceptions with rationale
