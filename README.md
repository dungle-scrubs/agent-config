# claude-config

Claude Code configuration files, symlinked to `~/.claude/` via GNU Stow.

## Dependencies

- [GNU Stow](https://www.gnu.org/software/stow/) - symlink manager
- [Nerd Font](https://www.nerdfonts.com/) - icons in status line
- [jq](https://jqlang.github.io/jq/) - JSON parsing in status line

```bash
brew install stow jq
```

## Setup

```bash
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
