# Global Instructions

## Bash Tool Guidelines

**Never use `&` with the regular `bash` tool to background processes.** The bash tool waits for stdout/stderr to close, so backgrounded processes that keep writing will cause the command to hang indefinitely.

For daemons, servers, or long-running processes, use `bg_bash` instead:
```
# WRONG - will hang:
bash: "my-daemon start &"

# CORRECT - returns immediately:
bg_bash: "my-daemon start"
```

Use `bg_bash` for:
- Starting daemons or servers
- Long-running builds or tests
- Any process you want to run independently

## Subagents for Parallel & Complex Tasks

Use the `subagent` tool to delegate tasks to specialized agents with isolated context.

### When to Use Parallel Subagents

**Use parallel mode when tasks are:**
- Independent (don't depend on each other's output)
- Can run concurrently without conflicts
- Each task is self-contained

**Examples of good parallel tasks:**
```
// Research multiple topics simultaneously
{ tasks: [
  { agent: "researcher", task: "Research React state management" },
  { agent: "researcher", task: "Research Vue reactivity system" },
  { agent: "researcher", task: "Research Svelte stores" }
]}

// Analyze multiple files independently
{ tasks: [
  { agent: "code-reviewer", task: "Review auth.ts for security issues" },
  { agent: "code-reviewer", task: "Review api.ts for security issues" },
  { agent: "code-reviewer", task: "Review database.ts for security issues" }
]}

// Generate multiple independent components
{ tasks: [
  { agent: "coder", task: "Create a Button component" },
  { agent: "coder", task: "Create an Input component" },
  { agent: "coder", task: "Create a Modal component" }
]}
```

### When to Use Chain Mode

**Use chain mode when tasks are:**
- Sequential (each step depends on the previous)
- Need to transform or build upon prior output

**Example:**
```
{ chain: [
  { agent: "researcher", task: "Research the topic: {topic}" },
  { agent: "writer", task: "Write an article based on: {previous}" },
  { agent: "editor", task: "Edit and improve: {previous}" }
]}
```

### When NOT to Use Subagents

- Simple tasks that can be done directly
- Tasks that need to modify the same files (use sequential instead)
- When you need real-time back-and-forth interaction

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
