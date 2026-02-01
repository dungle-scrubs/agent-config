# Contributing

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run linting: `npm run check`

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run checks: `npm run check && npm run typecheck`
5. Commit and push
6. Open a Pull Request

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Run `npm run check:fix` to auto-fix issues.

## Structure Guidelines

- **Commands** (`stow/shared/commands/`): Slash commands in Markdown format
- **Skills** (`stow/shared/skills/`): Reusable skill definitions
- **Extensions** (`stow/pi/extensions/`): TypeScript extensions for Pi
- **Agents** (`stow/*/agents/`): Custom agent definitions

## Pre-commit Hooks

Husky runs `npm run check` and `npm run typecheck` before each commit. If checks fail, the commit is blocked.

## Testing Extensions

Pi extensions can be tested by running Pi with the config symlinked:

```bash
./install.sh
pi  # Extensions load from ~/.pi/agent/extensions/
```
