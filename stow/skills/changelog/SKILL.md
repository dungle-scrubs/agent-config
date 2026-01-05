---
name: changelog
description: Changelogs following Keep a Changelog v1.1.0 standards. Triggers: changelog, CHANGELOG.md, release notes, version bump, document changes, release history.
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Changelog Standards

Create and maintain project changelogs based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/).

## When to Use This Skill

Activate this skill when:

- User **creates a new project** that needs a CHANGELOG.md
- User wants to **add a release** or **version bump**
- User mentions **changelog**, **release notes**, or **version history**
- User asks about **documenting changes** or **what changed**
- Agent needs to **update CHANGELOG.md** after making significant changes
- User asks about **semantic versioning** or **release practices**

## Core Principles

1. **Changelogs are for humans, not machines**
2. Each version should have an entry
3. Group similar types of changes
4. Make versions and sections linkable
5. List the latest version first
6. Include release dates (ISO 8601: YYYY-MM-DD)
7. Follow Semantic Versioning

## File Naming

- **Required**: `CHANGELOG.md`
- Alternatives: `HISTORY.md`, `NEWS.md`
- Use uppercase for main file

## Standard Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature descriptions

## [1.0.0] - 2023-06-08

### Added
- Initial release

[Unreleased]: https://github.com/user/repo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

## Change Types

Use these categories in this order:

### Added
New features
- New API endpoints
- Additional configuration options
- New command-line flags

### Changed
Changes in existing functionality
- Updated dependencies
- Modified default behavior
- Improved performance

### Deprecated
Soon-to-be removed features
- Legacy API methods
- Old configuration formats
- Outdated CLI commands

### Removed
Now removed features
- Deleted deprecated APIs
- Removed unused dependencies
- Eliminated legacy code paths

### Fixed
Bug fixes
- Resolved memory leaks
- Fixed crash conditions
- Corrected calculation errors

### Security
Vulnerability fixes (always include immediately)
- Patched security vulnerabilities
- Updated insecure dependencies
- Fixed authentication issues

## Best Practices

### Writing
- Write for humans, not machines
- Use clear, concise language
- Avoid technical jargon when possible
- Be specific about what changed

### Organization
- List newest versions first
- Group similar changes together
- Use consistent formatting
- Include links to releases/diffs

### Content
- Don't use git log dump
- Clearly mark breaking changes
- Document migration paths for deprecated features
- Include security fixes immediately

## Anti-Patterns to Avoid

- Dumping git commit logs
- Ignoring deprecations
- Confusing dates and versions
- Missing security notices
- Inconsistent formatting

## Creating a New Changelog

When creating a changelog for a new project:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
```

## Adding a New Release

1. Move items from `[Unreleased]` to new version section
2. Add date in ISO 8601 format
3. Update links at bottom
4. Keep `[Unreleased]` section (empty or with upcoming changes)

```markdown
## [Unreleased]

## [1.1.0] - 2024-01-15

### Added
- Features moved from Unreleased

[Unreleased]: https://github.com/user/repo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

## Versioning (SemVer)

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## Review Checklist

Before finalizing a changelog entry:

- [ ] Is it human-readable?
- [ ] Are versions in reverse chronological order?
- [ ] Is each change categorized correctly?
- [ ] Are security issues prominently noted?
- [ ] Are breaking changes clearly marked?
- [ ] Do links work correctly?

## Tools

### Generators
- [standard-version](https://github.com/conventional-changelog/standard-version)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [release-it](https://github.com/release-it/release-it)

### Validators
- [changelog-parser](https://github.com/hypermodules/changelog-parser)

## Examples

### Minimal Changelog

```markdown
# Changelog

## [Unreleased]

### Added
- New user authentication system

### Fixed
- Fixed memory leak in data processing

## [1.0.0] - 2023-06-08

### Added
- Initial release with core functionality
```

### Comprehensive Changelog

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- OAuth2 integration for user authentication
- Real-time notification system

### Changed
- Improved dashboard loading performance by 40%

### Deprecated
- Legacy API endpoints (v1) will be removed in v2.0.0

### Security
- Fixed XSS vulnerability in comment system

## [1.1.0] - 2023-07-15

### Added
- Dark mode theme support
- Advanced search filters

### Fixed
- Resolved database connection timeout issues

## [1.0.0] - 2023-06-08

### Added
- User registration and login system
- Basic dashboard functionality
- RESTful API endpoints

[Unreleased]: https://github.com/user/repo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

## Notes

- Source: [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/)
- Always maintain an `[Unreleased]` section at the top
- Security fixes should be documented and released immediately
