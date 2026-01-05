# claude-config

Claude Code configuration files, symlinked to `~/.claude/` via GNU Stow.

## Setup

```bash
# Install GNU Stow if needed
brew install stow

# Symlink configuration
./install.sh
```

## Structure

```
├── CLAUDE.md         # Global instructions for all projects
├── agents/           # Custom agents
├── commands/         # Slash commands
├── skills/           # Reusable skills
├── output-styles/    # Output formatting
└── settings.json     # Claude Code settings
```

## Usage

After running `install.sh`, Claude Code will automatically load these files from `~/.claude/`.

To add new configurations, create files in this repo and re-run `./install.sh`.
