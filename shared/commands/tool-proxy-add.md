---
description: Add a new tool to tool-proxy with session script, config, context.md, and embeddings. Use when integrating MCP servers or custom tools.
argument-hint: [tool-name or npm-package or git-url]
---

# Tool Proxy Add Command

## Purpose

Adds a complete tool to the tool-proxy system at `~/dev/ai/mcp/apps/`. This creates all required files, validates the structure, runs the indexer, and verifies embeddings exist in Neo4j.

**Key difference from MCP installation:** Tools are NOT registered in Claude Code's MCP config. Instead, they run as on-demand subprocesses managed by tool-proxy.

## Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$ARGUMENTS` | User input | Tool name, npm package, or git URL |
| `$TOOL_NAME` | Derived/Interactive | kebab-case name for the tool directory |
| `$TRANSPORT` | Auto-detected | `subprocess` (default) or `http` |
| `$MCP_SOURCE` | Parsed | Package name, git URL, or `custom` |

## Prerequisites

- Python 3.10+ (for session scripts)
- Neo4j running (for embeddings storage)
- `~/dev/ai/mcp/apps/tool-proxy/` exists
- OpenAI API key in `~/.env/models` (for embeddings)

## Workflow

### Phase 1: Parse Input and Gather Information

1. **Parse $ARGUMENTS to determine source type:**
   ```text
   IF contains 'github.com' OR '.git':
     → Git repository (use uvx)
   IF starts with '@' OR contains '/':
     → npm package (use npx)
   ELSE:
     → Custom tool name
   ```

2. **Derive tool name:**
   - From npm: `@modelcontextprotocol/server-postgres` → `postgres`
   - From git: `github.com/user/mcp-filesystem` → `filesystem`
   - From custom: use as-is (kebab-case)

3. **Check if tool already exists:**
   ```bash
   ls ~/dev/ai/mcp/apps/$TOOL_NAME/
   ```
   - IF exists: Ask user if they want to overwrite

4. **Gather tool details via interactive prompts:**
   - Description (1 sentence, for app.config.json)
   - Category (Utility, Development, Data, Communication, etc.)
   - Triggers (comma-separated keywords that should invoke this tool)
   - Not-for patterns (what this tool should NOT be used for)
   - Required environment variables (if any)

### Phase 2: Tool Introspection (MCP sources only)

5. **IF MCP source (npm or git):**
   - Spawn temporary MCP server
   - Send `initialize` + `tools/list` requests
   - Capture tool names, descriptions, schemas
   - Stop server

6. **Generate tools.json from introspection:**
   ```json
   [
     {
       "name": "tool_name",
       "description": "What it does",
       "inputSchema": { ... }
     }
   ]
   ```

### Phase 3: Create Files

7. **Create directory structure:**
   ```
   ~/dev/ai/mcp/apps/$TOOL_NAME/
   ├── app.config.json
   ├── tools.json
   ├── context.md
   └── scripts/
       └── {tool_name}_session.py
   ```

8. **Generate app.config.json:**
   ```json
   {
     "description": "$DESCRIPTION",
     "transport": "subprocess",
     "category": "$CATEGORY",
     "timeout_ms": 30000,
     "triggers": ["$TRIGGER1", "$TRIGGER2"],
     "not_for": ["$NOT_FOR1"]
   }
   ```

9. **Generate context.md:**
   - Tool overview
   - Available tools table
   - Usage examples
   - Security/limitations notes

10. **Generate session script:**
    - Python class with subprocess management
    - JSON-RPC communication (for MCP) or direct execution (for custom)
    - Tool-proxy protocol: read JSON from stdin, write JSON to stdout
    - Error handling with proper exit codes

### Phase 4: Validation

11. **Validate created files:**
    ```bash
    # Check all required files exist
    ls ~/dev/ai/mcp/apps/$TOOL_NAME/app.config.json
    ls ~/dev/ai/mcp/apps/$TOOL_NAME/tools.json
    ls ~/dev/ai/mcp/apps/$TOOL_NAME/context.md
    ls ~/dev/ai/mcp/apps/$TOOL_NAME/scripts/${TOOL_NAME}_session.py

    # Validate JSON syntax
    python -m json.tool ~/dev/ai/mcp/apps/$TOOL_NAME/app.config.json
    python -m json.tool ~/dev/ai/mcp/apps/$TOOL_NAME/tools.json

    # Check Python syntax
    python -m py_compile ~/dev/ai/mcp/apps/$TOOL_NAME/scripts/${TOOL_NAME}_session.py
    ```

### Phase 5: Index and Verify

12. **Run the tool-proxy indexer:**
    ```bash
    cd ~/dev/ai/mcp/apps/tool-proxy/server && pnpm index
    ```
    - Indexer uses incremental mode by default
    - Generates embeddings via OpenAI text-embedding-3-small
    - Stores in Neo4j with full-text index

13. **Verify embeddings exist:**
    ```bash
    # Query Neo4j to confirm tools were indexed
    # The indexer output will show success/failure
    ```
    - Check indexer output for "Indexed app" message
    - Verify tool count matches tools.json

14. **Test tool discovery:**
    ```bash
    # Use discover_tools to verify the new tool is findable
    echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"discover_tools","arguments":{"query":"$TOOL_NAME"}},"id":1}' | ...
    ```

## Instructions

### Session Script Template

For MCP-based tools:
```python
#!/usr/bin/env python3
"""Session script for $TOOL_NAME MCP server."""

import json
import subprocess
import sys

class Session:
    def __init__(self):
        self.process = None
        self.msg_id = 1

    def start(self):
        self.process = subprocess.Popen(
            ["npx", "-y", "$MCP_PACKAGE@latest"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        self._initialize()
        return self

    def call_tool(self, name, args):
        return self._send_request("tools/call", {"name": name, "arguments": args})

def run_tool_proxy_mode():
    if sys.stdin.isatty():
        return False
    request = json.load(sys.stdin)
    # ... handle request
    return True

if __name__ == "__main__":
    if not run_tool_proxy_mode():
        print("Interactive mode not supported")
```

For custom tools:
```python
#!/usr/bin/env python3
"""Session script for $TOOL_NAME."""

import json
import sys

TOOLS = {
    "tool_name": lambda args: ({"result": "..."}, False),
}

def run_tool_proxy_mode():
    if sys.stdin.isatty():
        return False
    request = json.load(sys.stdin)
    tool = request.get("tool")
    args = request.get("args", {})

    if tool not in TOOLS:
        print(json.dumps({"error": f"Unknown tool: {tool}"}))
        return True

    result, is_error = TOOLS[tool](args)
    if is_error:
        print(json.dumps({"error": result}))
    else:
        print(json.dumps({"result": json.dumps(result)}))
    return True

if __name__ == "__main__":
    if not run_tool_proxy_mode():
        print("Interactive mode")
```

### Naming Conventions

- Tool directory: kebab-case (`my-tool`)
- Session script: snake_case with `_session.py` suffix (`my_tool_session.py`)
- Tool names in tools.json: snake_case (`my_tool`)

### Required Environment Variables

If the tool needs API keys or secrets:
1. Add to `~/.env/services` or `~/.env/models`
2. Load in session script via `dotenv` or direct file read
3. Document in context.md

## Error Handling

| Error | Response |
|-------|----------|
| Directory already exists | Ask to overwrite or abort |
| MCP introspection fails | Create minimal structure, prompt for manual tools.json |
| Indexer fails | Check Neo4j connection, OpenAI API key |
| No embeddings generated | Re-run with `pnpm index:full` |
| Session script syntax error | Show error, fix before continuing |

## Success Criteria

```text
✅ Tool added to tool-proxy successfully
📁 Location: ~/dev/ai/mcp/apps/$TOOL_NAME/
📄 Files created:
   - app.config.json (config with triggers)
   - tools.json (N tools defined)
   - context.md (documentation)
   - scripts/${tool_name}_session.py (execution)
🔍 Indexer: N tools indexed with embeddings
🧪 Verification: Tool discoverable via discover_tools
```

## Examples

<example>
User: /tool-proxy:add @modelcontextprotocol/server-postgres

Process:
1. Detected npm package
2. Derived name: postgres
3. Introspected MCP server → 2 tools (query, list_tables)
4. Created ~/dev/ai/mcp/apps/postgres/
5. Ran indexer → 2 tools indexed
6. Verified embeddings in Neo4j

Result:
✅ Tool added to tool-proxy successfully
📁 Location: ~/dev/ai/mcp/apps/postgres/
🔍 Indexer: 2 tools indexed with embeddings
</example>

<example>
User: /tool-proxy:add calculator

Process:
1. Detected custom tool name
2. Prompted for description, category, triggers
3. Created ~/dev/ai/mcp/apps/calculator/
4. Generated tools.json with user-defined tools
5. Ran indexer → N tools indexed

Result:
✅ Tool added to tool-proxy successfully
📁 Location: ~/dev/ai/mcp/apps/calculator/
</example>

<example>
User: /tool-proxy:add github.com/anthropics/claude-code-mcp

Process:
1. Detected git repository
2. Derived name: claude-code
3. Introspected via uvx → M tools discovered
4. Created ~/dev/ai/mcp/apps/claude-code/
5. Ran indexer with embeddings

Result:
✅ Tool added to tool-proxy successfully
</example>

## Related Commands

- `/tool-proxy:remove`: Remove a tool from tool-proxy
- `/tool-proxy:reindex`: Re-run indexer for all tools

## Notes

This command replaces the old `mcp-skill` command. Key differences:
- Tools go to `~/dev/ai/mcp/apps/` not `.claude/skills/`
- Integrated with Neo4j graph database for semantic search
- Automatic embedding generation for tool discovery
- Validation and verification built-in
