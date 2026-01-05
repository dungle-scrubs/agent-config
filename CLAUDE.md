# claude-config

Claude Code configuration files managed via GNU Stow.

## Usage

```bash
./install.sh    # Symlink stow/ contents to ~/.claude/
```

## Structure

- `stow/` - Files symlinked to `~/.claude/`
  - `CLAUDE.md` - Global Claude Code context
  - `commands/` - Slash commands
  - `skills/` - Model-invoked skills
  - `agents/` - Custom agents
  - `settings.json` - CC settings

## Related

- `~/dev/ai/` - AI orchestration infrastructure (tool-proxy, orchestrator, MCP apps)
