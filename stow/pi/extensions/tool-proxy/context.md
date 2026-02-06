# Tool Proxy Context

## Paths

- **Apps directory:** `~/dev/tool-proxy/apps/`
- **List apps:** `ls ~/dev/tool-proxy/apps/`
- **Inspect app config:** `cat ~/dev/tool-proxy/apps/<app>/app.config.json`

## Secrets

**DO NOT hunt for credential files.** Tool-proxy uses varlock + 1Password.

- No `.env`, `secrets.json`, or credential files exist
- Secrets are in `.env.schema` as `op://` references
- Varlock resolves them at container start

### If "environment variable required" error:

```bash
# Check if declared
grep -i <VAR> ~/dev/tool-proxy/.env.schema

# Check if loaded in container
docker exec tool-proxy-tool-proxy-1 env | grep -i <VAR>

# If missing → restart container
cd ~/dev/tool-proxy && ./start.sh up -d
```

## Workflow

1. `discover_tools(query)` → find relevant tools
2. `get_app_context(app)` → **required** before execute_tool
3. `execute_tool(app, tool, args)` → run the tool

## Documentation Lookup (MANDATORY)

When you need documentation for any software tool, library, framework, API, SDK, CLI, or service:

1. **ALWAYS check local docs first** with `execute_tool(app: "docs", tool: "search_docs", args: { query: "..." })`
2. **If found locally**, read it with `execute_tool(app: "docs", tool: "get_doc", args: { name: "..." })`
3. **If NOT found locally**, add it with `execute_tool(app: "docs", tool: "add_doc", args: { name: "<Name>", url: "<official docs URL>" })`, then read with `get_doc`
4. **NEVER use `web-fetch` for documentation.** The docs tool scrapes, caches, and auto-refreshes. `web-fetch` wastes tokens on raw HTML and the content is lost after the session.

This applies to ALL documentation: official docs, API references, SDK guides, configuration docs, CLI references, getting started guides, changelogs, migration guides. If the content describes how to use software, it is documentation.

This does NOT apply to: search engine results, blog posts, news articles, Stack Overflow, GitHub issues/PRs, social media, Wikipedia, general web content.

### Available docs tools (no get_app_context needed)

- `search_docs` — Search across all cached docs
- `get_doc` — Read a doc by name (auto-refreshes if stale >24h)
- `add_doc` — Add a new doc URL to track and scrape immediately
- `list_docs` — List all tracked docs with freshness status
- `refresh_docs` — Force refresh specific or all stale docs
- `remove_doc` — Remove a doc from tracking
