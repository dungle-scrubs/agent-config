# agent-config

[![CI](https://github.com/dungle-scrubs/agent-config/actions/workflows/ci.yml/badge.svg)](https://github.com/dungle-scrubs/agent-config/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Configuration files for Claude Code, Codex, and Pi - managed via GNU Stow.

## Dependencies

- [GNU Stow](https://www.gnu.org/software/stow/) - symlink manager
- [Nerd Font](https://www.nerdfonts.com/) - icons in status line
- [jq](https://jqlang.github.io/jq/) - JSON parsing in status line
- [Node.js](https://nodejs.org/) - for development tooling

```bash
brew install stow jq node
```

## Setup

```bash
npm install      # Install dev dependencies
./install.sh     # Symlink configs to home directories
```

## Structure

```
stow/
├── claude-code/          # → ~/.claude/
│   ├── agents/           # Custom agents
│   ├── output-styles/    # Output formatting
│   ├── settings.json     # Claude Code settings
│   └── statusline/       # Status bar scripts
├── codex/                # → ~/.codex/
│   └── config.toml       # Codex configuration
├── pi/                   # → ~/.pi/
│   └── agent/
│       ├── AGENTS.md     # Global instructions
│       ├── agents/       # Custom agents
│       ├── extensions/   # TypeScript extensions
│       ├── prompts/      # Prompt templates
│       ├── settings.json # Pi settings
│       └── themes/       # Catppuccin themes
└── shared/               # Symlinked to all agents
    ├── commands/         # Slash commands
    ├── instructions.md   # Shared CLAUDE.md
    └── skills/           # Reusable skills
```

## Development

```bash
npm run check       # Lint and format check
npm run check:fix   # Auto-fix issues
npm run typecheck   # TypeScript type checking
```

Pre-commit hooks run `check` and `typecheck` automatically via Husky.

## Usage

After running `install.sh`:
- Claude Code loads configs from `~/.claude/`
- Codex loads configs from `~/.codex/`
- Pi loads configs from `~/.pi/`

To add new configurations, create files in the appropriate `stow/` directory and re-run `./install.sh`.

## Known Limitations

- Extensions use `@mariozechner/pi-coding-agent` types which have upstream vulnerabilities in transitive dependencies (fast-xml-parser via AWS SDK)
- Shared commands/skills are symlinked to multiple agents - changes affect all

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
