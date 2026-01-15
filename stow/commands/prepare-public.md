---
description: Prepare repository for public open-source release with security audit, CI/CD, linting, README, and best practices
---

# Prepare for Public Release

## Purpose

Audits and prepares a repository for public open-source release. Performs security scanning, dependency audit, CI/CD setup, linting/formatting tooling, generates comprehensive README, and identifies limitations.

## Variables

- **scope**: Level of preparation - `user` (interactive, asks preferences) or `auto` (uses sensible defaults)

## Prerequisites

- Git repository initialized
- Source code present in repository

## Process Flow

### Step 1: Security Audit

**CRITICAL**: Scan for secrets and sensitive data before ANY other work.

**Actions:**
1. Search for common secret patterns in current code:
   - API keys, tokens, passwords in code
   - `.env` files with real values
   - Private keys, certificates
   - Hardcoded credentials, connection strings
   - AWS/GCP/Azure credentials

2. Check for sensitive files that shouldn't be committed:
   - `*.pem`, `*.key`, `*.p12`
   - `credentials.json`, `secrets.*`
   - `.env` (unless `.env.example`)

3. **Scan git history for secrets** using TruffleHog:
   ```bash
   # Install: brew install trufflehog
   trufflehog git file://. --only-verified
   ```
   - Scans entire git history, not just current files
   - Detects high-entropy strings and known secret patterns (AWS keys, API tokens, etc.)
   - `--only-verified` reduces false positives by checking if secrets are active
   - If secrets found in history: squash history or use BFG Repo-Cleaner
   - TruffleHog will also be added to CI (Step 7) for ongoing scanning
   - **Tool choice:** TruffleHog for thoroughness (pre-release audits), gitleaks for speed (pre-commit hooks, CI)

4. IF secrets found:
   - **STOP** and report immediately
   - List each secret location and type
   - Recommend remediation (remove, rotate, add to .gitignore)
   - DO NOT proceed until user confirms secrets are handled

### Step 2: Dependency Audit

**Actions:**
1. Detect package manager and run appropriate audit:

| Package Manager | Audit Command |
|-----------------|---------------|
| npm/yarn | `npm audit` / `yarn audit` |
| Cargo | `cargo audit` (install: `cargo install cargo-audit`) |
| pip | `pip-audit` (install: `pip install pip-audit`) |
| Go | `govulncheck ./...` (install: `go install golang.org/x/vuln/cmd/govulncheck@latest`) |
| Swift | Manual check - no standard tool |

2. Report vulnerabilities by severity (critical, high, medium, low)

3. IF critical/high vulnerabilities:
   - List each with CVE and affected package
   - Recommend: update dependencies before public release

### Step 3: Large File and Binary Check

**Actions:**
1. Find large files that shouldn't be in git:
   ```bash
   git ls-files | xargs ls -la 2>/dev/null | awk '$5 > 1000000' | sort -k5 -rn
   ```

2. Find binary files that may be inappropriate:
   ```bash
   git ls-files | xargs file | grep -v "text\|empty\|JSON\|XML"
   ```

3. Check for common mistakes:
   - Compiled binaries (`*.exe`, `*.dll`, `*.so`, `*.dylib`)
   - Archives (`*.zip`, `*.tar.gz`)
   - Database files (`*.sqlite`, `*.db`)
   - IDE files (`.idea/`, `*.xcuserdata/`)
   - Build outputs (`dist/`, `build/`, `node_modules/`)

4. **Remove Claude Code artifacts:**
   - Delete `.claude/` folder (plans, settings, conversation logs)
   - Delete any `plan.md` or `*-plan.md` files
   - Add `.claude/` to .gitignore

5. IF problematic files found:
   - Recommend removal and .gitignore update
   - Consider: `git filter-branch` or BFG for history cleanup

### Step 4: Language and Tooling Detection

**Actions:**
1. Detect all languages present:
   - Check file extensions
   - Check for package managers (package.json, Cargo.toml, pyproject.toml, go.mod, etc.)
   - Check for build files (Makefile, CMakeLists.txt, etc.)

2. Identify existing tooling:
   - Linters already configured
   - Formatters already present
   - Pre-commit hooks

### Step 5: .gitignore Generation

**Actions:**
1. Check if .gitignore exists and is comprehensive

2. Generate/append language-specific patterns:

| Language | Essential Patterns |
|----------|-------------------|
| Node.js | `node_modules/`, `dist/`, `.env`, `*.log`, `.DS_Store` |
| Python | `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`, `.env` |
| Rust | `target/`, `Cargo.lock` (for libraries) |
| Go | `vendor/` (if not vendoring), binary name |
| Swift | `.build/`, `DerivedData/`, `*.xcodeproj/xcuserdata/`, `Package.resolved` |
| Java | `target/`, `*.class`, `*.jar`, `.gradle/` |

3. Always include:
   ```
   .DS_Store
   *.log
   .env
   .env.local
   *.swp
   *~
   ```

### Step 6: Linting and Formatting Setup

**IF scope = `user` AND multiple languages detected:**
- Use AskUserQuestion tool to determine preferences

**IF scope = `auto` OR single language:**
- Apply sensible defaults per language:

| Language | Linter | Formatter |
|----------|--------|-----------|
| TypeScript/JavaScript | ESLint | Prettier |
| Python | Ruff | Ruff |
| Rust | clippy | rustfmt |
| Go | golangci-lint | gofmt |
| Swift | SwiftLint | swift-format |
| Shell | shellcheck | shfmt |

**Actions:**
1. Add appropriate config files
2. Add lint/format scripts to package manager or Makefile
3. Pre-commit hooks (optional, depends on ecosystem):
   - **Node.js/Python**: Common, well-supported via husky/pre-commit framework
   - **Rust/Go**: Less common, CI usually sufficient
   - **Swift**: Rare, ecosystem didn't adopt pre-commit tooling (Xcode users rely on IDE)
   - Only recommend if typical for the language and user wants enforcement locally

### Step 7: CI/CD Setup (GitHub Actions)

**Actions:**
1. Create `.github/workflows/ci.yml` with:
   - Build step
   - Test step
   - Lint step (if configured)
   - Secret scanning (TruffleHog)

2. **Add secret scanning job to all CI workflows** (gitleaks preferred for CI speed):
```yaml
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
   Alternative (TruffleHog, more thorough but slower):
```yaml
      - uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

3. Language-specific templates (add `secrets` job to each):

**Node.js:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Python:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: pytest
```

**Rust:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo build --release
      - run: cargo test
      - run: cargo clippy -- -D warnings
```

**Go:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: go build ./...
      - run: go test ./...
      - run: golangci-lint run
```

**Swift (macOS):**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: swift build
      - run: swift test
```

3. Add matrix builds if cross-platform support needed

### Step 8: Limitation and Hardcoding Analysis

**Actions:**
1. Scan for hardcoded values that limit portability:
   - Absolute paths (especially user-specific like `/Users/`, `/home/`)
   - Platform-specific paths (`/opt/homebrew/` vs `/usr/local/`)
   - Hardcoded URLs, ports, hostnames
   - Magic numbers without constants
   - OS-specific code without cross-platform handling

2. For each limitation found:
   - Document the limitation
   - Suggest configurability approach (env vars, config file, CLI args)
   - Rate severity: blocking vs documentation-only

### Step 9: Best Practices Audit

**FOR EACH category, check and recommend:**

**Error Handling:**
- Are errors caught and handled appropriately?
- Are error messages user-friendly?
- Is there graceful degradation?

**Tests:**
- Does test infrastructure exist?
- Are there any tests?
- Tests should cover logic with edge cases, error paths, and non-obvious behavior
- Do NOT recommend ceremony tests (testing dictionary lookups, trivial getters, obvious code)
- If logic is simple and easily verified manually, tests may not be needed
- **Analyze if existing tests are overkill** - if tests just verify hardcoded data or trivial operations, recommend removing them
- Small CLI tools and utilities often don't need extensive test suites - don't over-engineer

**Build Script:**
- Is there a build script/Makefile?
- Are build steps documented?
- Can someone build from scratch?

**Configurability:**
- Can behavior be customized without code changes?
- Are there config files or env var support?

### Step 10: Generate README

**Required Sections:**

```markdown
# [Project Name]

[![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[One-paragraph description of what it does]

## Features

- [Feature 1]
- [Feature 2]

## Requirements

- [Dependency 1 with version]
- [Dependency 2 with version]
- [OS/platform requirements]

## Installation

[Step-by-step installation instructions]

## Building from Source

[Build commands]

## Usage

[Usage examples with actual commands]

## Configuration

[If applicable - config options, env vars, etc.]

## Known Limitations

- [Limitation 1]
- [Limitation 2]

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[License type - link to LICENSE file]

## Roadmap

- [ ] [Future feature/fix 1]
- [ ] [Future feature/fix 2]
```

**Badge options (ask user which to include):**
- CI status badge
- License badge
- Version/release badge
- Code coverage badge

### Step 11: License File

**IF no LICENSE file exists:**
- Use AskUserQuestion to ask preferred license:
  - MIT (permissive, simple)
  - Apache 2.0 (permissive, patent protection)
  - GPL v3 (copyleft)
  - BSD 3-Clause (permissive)

### Step 12: SECURITY.md

**Create SECURITY.md:**

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| x.x.x   | :white_check_mark: |
| < x.x   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities by emailing [EMAIL].

Do NOT open a public issue for security vulnerabilities.

You can expect:
- Acknowledgment within 48 hours
- Status update within 7 days
- Coordinated disclosure after fix is available
```

### Step 13: CONTRIBUTING.md

**Create CONTRIBUTING.md:**

```markdown
# Contributing

## Development Setup

1. Clone the repository
2. [Setup steps]

## Making Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`[test command]`)
5. Run linter (`[lint command]`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Code Style

[Linting/formatting requirements]

## Testing

[How to run tests, what coverage is expected]
```

### Step 14: Issue and PR Templates

**Create `.github/ISSUE_TEMPLATE/bug_report.md`:**

```markdown
---
name: Bug report
about: Report a bug
title: '[BUG] '
labels: bug
---

**Describe the bug**
A clear description of the bug.

**To Reproduce**
Steps to reproduce:
1.
2.
3.

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g., macOS 14.0]
- Version: [e.g., 1.0.0]

**Additional context**
Any other context.
```

**Create `.github/ISSUE_TEMPLATE/feature_request.md`:**

```markdown
---
name: Feature request
about: Suggest a feature
title: '[FEATURE] '
labels: enhancement
---

**Problem**
What problem does this solve?

**Proposed solution**
How should it work?

**Alternatives considered**
Other approaches you've considered.
```

**Create `.github/PULL_REQUEST_TEMPLATE.md`:**

```markdown
## Summary
[Brief description of changes]

## Changes
-
-

## Testing
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Linter passes

## Related Issues
Closes #
```

### Step 15: Package Registry Prep (if applicable)

**IF publishing to a registry:**

**npm:**
- Ensure `package.json` has: name, version, description, main, repository, keywords, author, license
- Add `files` array or `.npmignore`
- Add `prepublishOnly` script for build

**PyPI:**
- Ensure `pyproject.toml` has all metadata
- Add `README.md` to long_description
- Consider `twine check`

**Cargo:**
- Ensure `Cargo.toml` has: description, license, repository, readme, keywords, categories
- Run `cargo publish --dry-run`

### Step 16: Final Report

**Output summary:**

```
## Public Release Preparation Report

### Security
- [ ] No secrets in code
- [ ] No secrets in git history
- [ ] Dependencies audited

### Files Created
- [ ] .gitignore (updated)
- [ ] .github/workflows/ci.yml
- [ ] README.md
- [ ] LICENSE
- [ ] SECURITY.md
- [ ] CONTRIBUTING.md
- [ ] .github/ISSUE_TEMPLATE/bug_report.md
- [ ] .github/ISSUE_TEMPLATE/feature_request.md
- [ ] .github/PULL_REQUEST_TEMPLATE.md
- [ ] Linter config

### Limitations Documented
- [List of limitations]

### Recommendations
- [Any remaining items]

### Next Steps
1. Review all generated files
2. Commit changes
3. Squash git history (if needed): `git checkout --orphan main-clean && git add -A && git commit -m "Initial commit" && git branch -D main && git branch -m main && git push -f origin main`
4. Make repository public
5. Create first release/tag
```

## Error Scenarios

- **Secrets detected**: Block all progress, report immediately
- **Critical vulnerabilities**: Warn but allow continuation with acknowledgment
- **No source files**: Report empty repository
- **Existing conflicting config**: Ask user whether to merge or replace

## Best Practices

- ALWAYS run security audit first - never skip
- Document limitations rather than hiding them
- Prefer standard tools over obscure ones
- Keep README concise but complete
- Roadmap should reflect actual planned work, not wishlist

## Notes

This command modifies files. Review all changes before committing. The security audit is intentionally blocking - a repository with exposed secrets should never be made public.
