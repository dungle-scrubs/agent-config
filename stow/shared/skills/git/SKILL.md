---
name: git
description: "Git conventions for commits, branches, and PRs. Apply when writing commit messages, naming branches, staging files, or creating pull requests."
---

# Git Standards

## Conventional Commits

Format: `type(scope): description`

Types:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic change)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Commit Messages

- Brief description (50 chars or less for first line)
- Focus on "why" not "what"
- Use imperative mood ("add feature" not "added feature")
- No AI attribution (forbidden)

## Branch Naming

- Use kebab-case: `feature-auth`, `fix-validation`, `docs-readme`
- Prefix with type when appropriate: `feature-*`, `fix-*`, `docs-*`
- No date prefixes

## Files to Never Stage

- `node_modules/` - Dependencies
- `.env*` - Environment files with secrets
- `.DS_Store` - macOS system files
- `dist/`, `build/` - Build artifacts
- `*.log` - Log files
- `.claude/logs/` - Claude logs
- `*.backup` - Backup files
- Credentials files (credentials.json, etc.)

## PR Description Template

```markdown
## Summary
[1-3 bullet points]

## Changes Made
- [Change 1]
- [Change 2]

## Testing
- [Test coverage description]
```

## Quick Reference

| Action | Convention |
|--------|------------|
| New feature | `feat(scope): add X` |
| Bug fix | `fix(scope): resolve X` |
| Breaking change | `feat!:` or `BREAKING CHANGE:` in body |
| Branch for feature | `feature-descriptive-name` |
| Branch for fix | `fix-descriptive-name` |
