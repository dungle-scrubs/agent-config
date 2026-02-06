# Claude Code Plugins Loader for Pi

Load and use Claude Code plugins in Pi.

## Features

- Load plugins from local directories
- Supports both **commands** (`commands/*.md`) and **skills** (`skills/*/SKILL.md`)
- Commands invoked as `/plugin-name:command-name`
- Skills invoked as `/plugin-name:skill-name`
- `$ARGUMENTS` placeholder substitution for commands
- `User: <args>` appending for skills

## Configuration

Edit `cc-plugins.json` in this directory:

```json
{
  "plugins": [
    {
      "source": "~/dev/claude-plugins/my-plugin",
      "enabled": true
    },
    {
      "source": "/absolute/path/to/plugin",
      "name": "custom-name",
      "enabled": true
    }
  ]
}
```

### Plugin Config Options

| Field     | Type    | Description                                      |
|-----------|---------|--------------------------------------------------|
| `source`  | string  | Path to plugin directory (supports `~`)          |
| `name`    | string  | Override plugin name (default: from manifest)    |
| `enabled` | boolean | Enable/disable plugin (default: true)            |

## Usage

```bash
# List all loaded plugins and commands
/cc-plugins

# Run a command
/fuse:prime

# Run a command with arguments
/fuse:plan Create a new dashboard widget

# Run a skill
/fuse:database

# Run a skill with arguments
/fuse:notion update card FU-123
```

## Plugin Structure

Claude Code plugins must have this structure:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json       # Required: { "name": "my-plugin", "version": "1.0.0" }
├── commands/             # Optional: slash commands
│   ├── foo.md
│   └── bar.md
└── skills/               # Optional: model-invoked skills
    └── my-skill/
        └── SKILL.md
```

### Command Format

```markdown
---
description: What this command does
argument-hint: [optional hint]
---

Your command content here.

Use $ARGUMENTS to reference user input.
```

### Skill Format

```markdown
---
name: my-skill
description: What this skill does
---

Skill instructions here.
```

## Limitations

- No autocomplete for plugin commands (use `/cc-plugins` to see available commands)
- Only local paths supported (no npm/git sources yet)
- Hooks and MCP servers from Claude Code plugins are not loaded
