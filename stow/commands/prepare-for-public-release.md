---
description: Prepare any repository for public open-source release with intelligent language detection and distribution setup
---

# Prepare for Public Release

## Purpose

Audits and prepares a repository for public open-source release. Performs security scanning, dependency audit, CI/CD setup, linting/formatting tooling, generates comprehensive README, and configures appropriate distribution channels based on detected language/framework.

**Smart Detection**: Automatically identifies project type and only presents relevant distribution options (npm for Node.js, Homebrew for Swift CLI tools, Go modules, etc.).

## Variables

- **scope**: Level of preparation - `user` (interactive, asks preferences) or `auto` (uses sensible defaults). Default: `user`

## Prerequisites

- Git repository initialized
- Source code present in repository

## Process Flow

### Step 1: Project Detection

**Actions:**
1. Detect all languages and frameworks present:

| Indicator | Language/Framework |
|-----------|-------------------|
| `package.json` | Node.js/TypeScript |
| `go.mod` | Go |
| `Package.swift` | Swift |
| `pyproject.toml` or `setup.py` | Python |
| `Makefile` only | C/C++ |

2. Detect project type:

| Indicator | Type |
|-----------|------|
| `NSApplication`, `AppKit`, `UIKit` imports | macOS/iOS App |
| `main.swift` or executable target | CLI Tool |
| Library target only | Library |
| `bin/` directory or shebang scripts | CLI Tool |
| Express/Fastify/Hono imports | Web Server |
| React/Vue/Svelte | Frontend App |

3. Store detection results for later steps:
   - `LANGUAGES[]` - All detected languages
   - `PRIMARY_LANGUAGE` - Main language (most code)
   - `PROJECT_TYPE` - app, cli, library, server, frontend
   - `HAS_SERVICE` - Boolean: needs to run as background service

### Step 2: Security Audit

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
   - Detects high-entropy strings and known secret patterns
   - `--only-verified` reduces false positives
   - IF secrets found in history: recommend squashing history or BFG Repo-Cleaner

4. **IF secrets found:**
   - **STOP** and report immediately
   - List each secret location and type
   - Recommend remediation (remove, rotate, add to .gitignore)
   - DO NOT proceed until user confirms secrets are handled

### Step 3: Dependency Audit

**Actions:**
1. FOR EACH detected package manager, run appropriate audit:

| Package Manager | Audit Command |
|-----------------|---------------|
| npm/yarn/pnpm | `npm audit` / `yarn audit` / `pnpm audit` |
| pip | `pip-audit` (install: `pip install pip-audit`) |
| Go | `govulncheck ./...` (install: `go install golang.org/x/vuln/cmd/govulncheck@latest`) |
| Swift | Manual check - no standard tool |

2. Report vulnerabilities by severity (critical, high, medium, low)

3. IF critical/high vulnerabilities:
   - List each with CVE and affected package
   - Recommend: update dependencies before public release

### Step 4: Large File and Binary Check

**Actions:**
1. Find large files (>1MB) in git:
   ```bash
   git ls-files | xargs ls -la 2>/dev/null | awk '$5 > 1000000' | sort -k5 -rn
   ```

2. Find binary files:
   ```bash
   git ls-files | xargs file | grep -v "text\|empty\|JSON\|XML"
   ```

3. Check for common mistakes:
   - Compiled binaries (`*.exe`, `*.dll`, `*.so`, `*.dylib`)
   - Archives (`*.zip`, `*.tar.gz`)
   - Database files (`*.sqlite`, `*.db`)
   - IDE files (`.idea/`, `*.xcuserdata/`)
   - Build outputs (`dist/`, `build/`, `node_modules/`, `.build/`)

4. **Remove Claude Code artifacts:**
   - Delete `.claude/` folder (plans, settings, conversation logs)
   - Delete any `plan.md` or `*-plan.md` files
   - Add `.claude/` to .gitignore

5. IF problematic files found:
   - Recommend removal and .gitignore update
   - For files in history: recommend `git filter-branch` or BFG

### Step 5: .gitignore Generation

**Actions:**
1. Check if .gitignore exists and is comprehensive

2. FOR EACH detected language, add patterns:

| Language | Essential Patterns |
|----------|-------------------|
| Node.js | `node_modules/`, `dist/`, `.env`, `*.log`, `.DS_Store` |
| Python | `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`, `.env` |
| Go | `vendor/` (if not vendoring), binary name |
| Swift | `.build/`, `DerivedData/`, `*.xcodeproj/xcuserdata/`, `Package.resolved` |

3. ALWAYS include:
   ```
   .DS_Store
   *.log
   .env
   .env.local
   *.swp
   *~
   .claude/
   ```

### Step 6: Linting and Formatting Setup

**IF scope = `user` AND multiple languages detected:**
- Use AskUserQuestion to determine preferences

**IF scope = `auto` OR single language:**
- Apply sensible defaults:

| Language | Linter | Formatter |
|----------|--------|-----------|
| TypeScript/JavaScript | ESLint | Prettier |
| Python | Ruff | Ruff |
| Go | golangci-lint | gofmt |
| Swift | SwiftLint | swift-format |
| Shell | shellcheck | shfmt |

**Actions:**
1. Add appropriate config files
2. Add lint/format scripts to package manager or Makefile
3. Pre-commit hooks (language-dependent):
   - **Node.js/Python**: Common - recommend husky/pre-commit
   - **Go**: Less common - CI usually sufficient
   - **Swift**: Rare - ecosystem didn't adopt pre-commit tooling

### Step 7: CI/CD Setup (GitHub Actions)

**Actions:**
1. Create `.github/workflows/ci.yml` based on PRIMARY_LANGUAGE:

**Secret scanning job (add to ALL workflows):**
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

**IF PRIMARY_LANGUAGE = Node.js/TypeScript:**
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
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**IF PRIMARY_LANGUAGE = Python:**
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

**IF PRIMARY_LANGUAGE = Go:**
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

**IF PRIMARY_LANGUAGE = Swift:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: swift build -c release
      - run: swift test
```

### Step 8: Limitation and Hardcoding Analysis

**Actions:**
1. Scan for hardcoded values that limit portability:
   - Absolute paths (especially `/Users/`, `/home/`)
   - Platform-specific paths (`/opt/homebrew/` vs `/usr/local/`)
   - Hardcoded URLs, ports, hostnames
   - Magic numbers without constants
   - OS-specific code without cross-platform handling

2. FOR EACH limitation found:
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
- Do NOT recommend ceremony tests (testing trivial getters, obvious code)
- **Analyze if existing tests are overkill** - if tests just verify hardcoded data, recommend removing them
- Small CLI tools often don't need extensive test suites

**Build Script:**
- Is there a build script/Makefile?
- Are build steps documented?
- Can someone build from scratch?

**Configurability:**
- Can behavior be customized without code changes?
- Are there config files or env var support?

**Code Documentation:**
- **All functions must have JSDoc-style comments** explaining WHY the function exists (not what it does)
- Use language-appropriate comment format:
  - TypeScript/JavaScript: `/** ... */`
  - Python: docstrings with triple quotes
  - Go: `// FunctionName ...` above function
  - Swift: `/// ...` or `/** ... */`
- Focus on intent, edge cases, and non-obvious behavior
- Do NOT add comments to trivial getters/setters

**CLI Help Flag:**
- **All CLI tools MUST implement `--help` and `-h` flags**
- Help output should include:
  - Brief description of the tool
  - Usage syntax
  - Available commands/subcommands
  - Available flags with descriptions
  - Examples (1-2 common use cases)
- Follow platform conventions (GNU-style for cross-platform, BSD-style acceptable for macOS-only)

### Step 10: License File

**IF no LICENSE file exists:**
- Use AskUserQuestion to ask preferred license:
  - MIT (permissive, simple)
  - Apache 2.0 (permissive, patent protection)
  - GPL v3 (copyleft)
  - BSD 3-Clause (permissive)

**Copyright holder:** Kevin Frilot
**GitHub username:** dungle-scrubs

### Step 11: Generate README

**Create README.md with required sections:**

```markdown
# [Project Name]

[![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[One-paragraph description]

## Features

- [Feature 1]
- [Feature 2]

## Requirements

- [Dependency with version]
- [OS/platform requirements]

## Installation

[Step-by-step installation - language appropriate]

## Building from Source

[Build commands]

## Usage

[Usage examples with actual commands]

## Configuration

[If applicable - config options, env vars]

## Known Limitations

- [Limitation 1]
- [Limitation 2]

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[License type - link to LICENSE file]
```

### Step 12: Supporting Documentation

**Create SECURITY.md:**
```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| x.x.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities by emailing [EMAIL].

Do NOT open a public issue for security vulnerabilities.
```

**Create CONTRIBUTING.md:**
```markdown
# Contributing

## Development Setup

1. Clone the repository
2. [Setup steps based on detected language]

## Making Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Run linter
6. Commit and push
7. Open a Pull Request

## Code Style

[Based on configured linter/formatter]
```

**Create issue templates:**
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

### Step 13: Distribution Setup

**Ask user if they want to publish this package to a registry/distribution channel.**

IF user declines: Skip to Step 14

**Based on PROJECT_TYPE and PRIMARY_LANGUAGE, offer relevant options:**

---

#### IF PRIMARY_LANGUAGE = Node.js/TypeScript AND PROJECT_TYPE = library:

**npm Registry Setup**

1. Ensure `package.json` has required fields:
```json
{
  "name": "@scope/package-name",
  "version": "0.1.0",
  "description": "One-line description",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "prepublishOnly": "npm run build"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/USER/REPO.git"
  },
  "license": "MIT"
}
```

2. Create `.github/workflows/publish.yml`:
```yaml
name: Publish to npm
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build --if-present
      - run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

3. Document NPM_TOKEN setup in PUBLISHING.md

---

#### IF PRIMARY_LANGUAGE = Python AND PROJECT_TYPE = library:

**PyPI Setup**

1. Ensure `pyproject.toml` has required fields:
```toml
[project]
name = "package-name"
version = "0.1.0"
description = "One-line description"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.10"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

2. Create `.github/workflows/publish.yml`:
```yaml
name: Publish to PyPI
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install build
      - run: python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
```

3. Document Trusted Publisher setup

---

#### IF PRIMARY_LANGUAGE = Go:

**Go Module Setup**

Go modules are automatically available via `go get` when pushed to a public repository.

1. Ensure `go.mod` has proper module path:
```go
module github.com/USER/REPO
```

2. **IF PROJECT_TYPE = cli:** Add goreleaser for binary releases (see Binary Releases section)

3. Tag releases with semantic versioning:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Users install with: `go install github.com/USER/REPO@latest`

---

#### IF PRIMARY_LANGUAGE = Swift AND PROJECT_TYPE = cli:

**Homebrew Tap Setup**

1. **Create formula file** `Formula/[tool-name].rb`:
```ruby
class ToolName < Formula
  desc "One-line description"
  homepage "https://github.com/USER/REPO"
  url "https://github.com/USER/REPO/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "PLACEHOLDER"
  license "MIT"

  depends_on :macos
  depends_on xcode: ["15.0", :build]

  def install
    system "swift", "build", "-c", "release", "--disable-sandbox"
    bin.install ".build/release/tool-name"
  end

  # IF HAS_SERVICE = true:
  service do
    run [opt_bin/"tool-name"]
    keep_alive true
    log_path var/"log/tool-name.log"
    error_log_path var/"log/tool-name.err"
  end

  test do
    system bin/"tool-name", "--version"
  end
end
```

2. **Ask user**: Create tap in same repo or separate `homebrew-tap` repo?

   **Option A: Same repo** (simpler for single tool)
   - Create `Formula/` directory in this repo
   - Users install: `brew install USER/REPO/tool-name`

   **Option B: Separate tap repo** (better for multiple tools)
   - Create new repo `homebrew-tap`
   - Users install: `brew tap USER/tap && brew install tool-name`

3. **Create release workflow** `.github/workflows/release.yml` with **multi-architecture builds**:
```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - arch: arm64
            runner: macos-14    # Apple Silicon
          - arch: x86_64
            runner: macos-13    # Intel
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v4

      - name: Build release binary
        run: swift build -c release

      - name: Create tarball
        run: |
          mkdir -p dist
          cp .build/release/tool-name dist/
          tar -czvf tool-name-${{ github.ref_name }}-darwin-${{ matrix.arch }}.tar.gz -C dist tool-name

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: tool-name-darwin-${{ matrix.arch }}
          path: tool-name-${{ github.ref_name }}-darwin-${{ matrix.arch }}.tar.gz

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Download artifacts
        uses: actions/download-artifact@v4

      - name: Calculate SHA256
        id: sha
        run: |
          ARM_SHA=$(shasum -a 256 tool-name-darwin-arm64/*.tar.gz | cut -d' ' -f1)
          X86_SHA=$(shasum -a 256 tool-name-darwin-x86_64/*.tar.gz | cut -d' ' -f1)
          echo "arm64_sha=$ARM_SHA" >> $GITHUB_OUTPUT
          echo "x86_64_sha=$X86_SHA" >> $GITHUB_OUTPUT

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            tool-name-darwin-arm64/*.tar.gz
            tool-name-darwin-x86_64/*.tar.gz
          body: |
            ## Installation

            ### Homebrew (recommended)
            ```bash
            brew install USER/REPO/tool-name
            brew services start tool-name
            ```

            ### Manual download
            **Apple Silicon (M1/M2/M3/M4):**
            ```bash
            curl -L URL/tool-name-${{ github.ref_name }}-darwin-arm64.tar.gz | tar xz
            mv tool-name /usr/local/bin/
            ```

            **Intel:**
            ```bash
            curl -L URL/tool-name-${{ github.ref_name }}-darwin-x86_64.tar.gz | tar xz
            mv tool-name /usr/local/bin/
            ```

            ## Checksums
            | Architecture | SHA256 |
            |--------------|--------|
            | arm64 | `${{ steps.sha.outputs.arm64_sha }}` |
            | x86_64 | `${{ steps.sha.outputs.x86_64_sha }}` |

  update-formula:
    needs: release
    runs-on: macos-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main

      - name: Download source tarball and calculate SHA
        run: |
          curl -L -o release.tar.gz "https://github.com/USER/REPO/archive/refs/tags/${{ github.ref_name }}.tar.gz"
          SHA=$(shasum -a 256 release.tar.gz | cut -d' ' -f1)
          echo "SHA256=$SHA" >> $GITHUB_ENV

      - name: Update formula
        run: |
          sed -i '' "s/sha256 \".*\"/sha256 \"$SHA256\"/" Formula/tool-name.rb
          sed -i '' "s|/v[0-9]*\.[0-9]*\.[0-9]*.tar.gz|/${{ github.ref_name }}.tar.gz|g" Formula/tool-name.rb

      - name: Commit formula update
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add Formula/tool-name.rb
          git diff --staged --quiet || git commit -m "Update formula for ${{ github.ref_name }}"
          git push origin main
```

**Note**: The release workflow builds for both Apple Silicon (arm64) and Intel (x86_64) architectures. Homebrew builds from source and auto-detects architecture, but pre-built binaries let users skip compilation.

4. **Add standard CLI flags** (required for `brew test` and usability):
   - `--version` / `-v`: Print version string and exit
   - `--help` / `-h`: Print usage information and exit
   - Help should document all commands and flags

5. **Document usage:**
```markdown
## Installation

### Homebrew (macOS)

```bash
brew install USER/REPO/tool-name
```

### Start as service (runs at login)

```bash
brew services start tool-name
```

### Building from source

```bash
swift build -c release
cp .build/release/tool-name /usr/local/bin/
```
```

---

#### IF PROJECT_TYPE = cli AND PRIMARY_LANGUAGE = Go:

**Binary Releases with goreleaser**

Create `.goreleaser.yaml`:
```yaml
version: 2
builds:
  - env:
      - CGO_ENABLED=0
    goos:
      - linux
      - darwin
      - windows
    goarch:
      - amd64
      - arm64
    ldflags:
      - -s -w -X main.version={{.Version}}

archives:
  - format: tar.gz
    format_overrides:
      - goos: windows
        format: zip

checksum:
  name_template: 'checksums.txt'

release:
  github:
    owner: USER
    name: REPO
```

Create `.github/workflows/release.yml`:
```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - uses: goreleaser/goreleaser-action@v5
        with:
          version: latest
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Step 14: CHANGELOG Setup

**Create CHANGELOG.md:**
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - YYYY-MM-DD

### Added

- Initial release
```

### Step 15: Final Report

**Output summary:**

```
## Public Release Preparation Report

### Project Detection
- Primary Language: [LANGUAGE]
- Project Type: [TYPE]
- Has Service: [YES/NO]

### Security
- [ ] No secrets in code
- [ ] No secrets in git history
- [ ] Dependencies audited

### Files Created/Updated
- [ ] .gitignore
- [ ] .github/workflows/ci.yml
- [ ] README.md
- [ ] LICENSE
- [ ] SECURITY.md
- [ ] CONTRIBUTING.md
- [ ] .github/ISSUE_TEMPLATE/
- [ ] .github/PULL_REQUEST_TEMPLATE.md
- [ ] Linter config
- [ ] CHANGELOG.md

### Distribution Setup
- [ ] [Registry/method configured]
- [ ] .github/workflows/publish.yml or release.yml
- [ ] Version: 0.1.0

### Limitations Documented
- [List of limitations]

### Recommendations
- [Any remaining items]

### Next Steps
1. Review all generated files
2. Commit changes
3. Create initial release/tag
4. [Registry-specific setup if needed]
5. Make repository public
```

## Error Scenarios

- **Secrets detected**: Block all progress, report immediately, DO NOT proceed
- **Critical vulnerabilities**: Warn but allow continuation with acknowledgment
- **No source files**: Report empty repository
- **Existing conflicting config**: Ask user whether to merge or replace
- **Unsupported language**: Fall back to generic CI and manual distribution docs

## Examples

<example>
Context: Swift CLI tool with LaunchAgent service

User: `/prepare-for-public-release`

Detection:
- PRIMARY_LANGUAGE: Swift
- PROJECT_TYPE: cli
- HAS_SERVICE: true (detected NSApplication, .accessory policy)

Result:
- CI workflow for macOS with swift build/test
- Homebrew formula with `service` block
- Release workflow that updates formula SHA
- LaunchAgent managed via `brew services`
</example>

<example>
Context: TypeScript library

User: `/prepare-for-public-release`

Detection:
- PRIMARY_LANGUAGE: TypeScript
- PROJECT_TYPE: library

Result:
- CI workflow with Node.js 22
- ESLint + Prettier setup
- npm publish workflow with provenance
- package.json updated with required fields
</example>

<example>
Context: Go CLI tool

User: `/prepare-for-public-release`

Detection:
- PRIMARY_LANGUAGE: Go
- PROJECT_TYPE: cli

Result:
- CI workflow with Go 1.22 + golangci-lint
- goreleaser config for cross-platform binaries
- Release workflow triggered on tags
- Users install via `go install` or download binaries
</example>

## Best Practices

- **ALWAYS run security audit first** - never skip this step
- **Document limitations** rather than hiding them
- **Prefer standard tools** over obscure ones
- Keep README concise but complete
- Only create distribution configs for detected project types
- Match community expectations for each language ecosystem

## Notes

This command modifies files. Review all changes before committing. The security audit is intentionally blocking - a repository with exposed secrets should never be made public.

For Swift macOS tools: The Homebrew `service` block automatically generates and manages a LaunchAgent plist. Users run `brew services start tool-name` instead of manually creating plists.
