---
name: upgrade-deps
description: Upgrade TypeScript/JavaScript dependencies automatically for patch/minor and interactively for major changes. Detects related dependency groups like Storybook. Triggers on upgrade dependencies, update packages, outdated deps, npm update, dependency audit, bump versions.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task, AskUserQuestion
---

# Dependency Upgrade Skill

Intelligently upgrade npm/pnpm/yarn dependencies with automatic patch/minor updates and interactive major version decisions.

## When to Use This Skill

Activate when user mentions:

- Upgrading or updating dependencies
- Checking for outdated packages
- Dependency audit or maintenance
- Bumping package versions
- npm update, pnpm update, yarn upgrade

## Core Capabilities

1. **Detect Outdated Dependencies**: Scan package.json and identify all outdated packages
2. **Categorize by Semver**: Group into patch, minor, and major updates
3. **Identify Related Groups**: Detect packages that should be updated together (e.g., Storybook, ESLint, React)
4. **Auto-Update Safe Changes**: Apply patch and minor updates automatically
5. **Interactive Major Upgrades**: Ask user for each major/breaking change
6. **Generate Report**: Summary of what was updated, skipped, or needs attention

## Workflow

### Phase 1: Analysis

1. Detect package manager (npm, pnpm, or yarn)
2. Run `./scripts/analyze-deps.ts` to get outdated dependencies
3. Parse output to categorize updates

### Phase 2: Identify Dependency Groups

Common related dependency groups to check:

| Group | Pattern | Notes |
|-------|---------|-------|
| Storybook | `@storybook/*`, `storybook` | Must all be same version |
| React | `react`, `react-dom`, `@types/react*` | Keep in sync |
| ESLint | `eslint`, `@eslint/*`, `eslint-*` | Plugin compatibility |
| TypeScript | `typescript`, `@types/*` | Types should match TS version |
| Testing Library | `@testing-library/*` | Keep in sync |
| Vite | `vite`, `@vitejs/*`, `vite-*` | Plugin compatibility |
| Next.js | `next`, `@next/*`, `eslint-config-next` | Framework bundle |
| Tailwind | `tailwindcss`, `@tailwindcss/*`, `postcss`, `autoprefixer` | Often updated together |
| Prisma | `prisma`, `@prisma/*` | CLI and client must match |
| tRPC | `@trpc/*` | All packages same version |

### Phase 3: Automatic Updates (Patch/Minor)

For each safe update:
1. Check if part of a dependency group
2. If grouped, update all related packages together
3. Run update command
4. Verify installation succeeds

### Phase 4: Major Version Investigation

For each major update (or group):
1. **Launch a subagent** via Task tool to investigate:
   - Fetch changelog/release notes
   - Identify breaking changes
   - Check migration guide
   - Assess impact on codebase
2. Present findings to user via AskUserQuestion
3. Options: Update, Skip, or Defer

### Phase 5: Report Generation

Generate final report:

```markdown
## Dependency Upgrade Report

### Automatically Updated (Patch/Minor)
| Package | From | To | Type |
|---------|------|-----|------|
| lodash | 4.17.20 | 4.17.21 | patch |

### Major Updates Applied
| Package | From | To | Notes |
|---------|------|-----|-------|
| react | 17.0.2 | 18.2.0 | User approved |

### Skipped
| Package | From | To | Reason |
|---------|------|-----|--------|
| webpack | 4.46.0 | 5.88.0 | User deferred |

### Errors
| Package | Error |
|---------|-------|
| none | - |
```

## Scripts

### analyze-deps.ts

Location: `./scripts/analyze-deps.ts`

Detects package manager and outputs structured JSON of outdated dependencies:

```typescript
// Output format
interface OutdatedDep {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'patch' | 'minor' | 'major';
  depType: 'dependencies' | 'devDependencies' | 'peerDependencies';
  group?: string; // e.g., 'storybook', 'react', 'eslint'
}
```

Run with: `npx tsx ./scripts/analyze-deps.ts [project-path]`

### group-deps.ts

Location: `./scripts/group-deps.ts`

Groups dependencies by their related packages:

Run with: `npx tsx ./scripts/group-deps.ts [project-path]`

## Subagent Instructions

When spawning subagents for major version investigation, use this prompt template:

```
Investigate the major version upgrade for [PACKAGE] from [CURRENT] to [LATEST].

Tasks:
1. Search for the changelog or release notes
2. Identify breaking changes that affect this codebase
3. Find migration guide if available
4. Check if any code in the project uses deprecated APIs
5. Summarize: impact level (low/medium/high), required changes, and recommendation

Return a structured assessment:
- Breaking changes found
- Files in codebase that may need updates
- Estimated effort (trivial/moderate/significant)
- Recommendation (safe to upgrade / needs code changes / risky)
```

## User Questions

When asking about major updates, use this format:

```
Major update available: [package] [current] → [latest]

Breaking changes:
- [change 1]
- [change 2]

Impact on your code:
- [file1]: uses deprecated API X
- [file2]: no impact

Recommendation: [recommendation]
```

Options:
- **Update now** - Apply the upgrade
- **Skip** - Keep current version
- **Defer** - Add to a follow-up list

## Error Handling

- **Lock file conflicts**: Run install command to regenerate
- **Peer dependency issues**: Report which packages conflict
- **Build failures after update**: Rollback and report
- **Network errors**: Retry with backoff

## Configuration

The skill respects these files if present:

- `.npmrc` - npm configuration
- `.nvmrc` / `.node-version` - Node version constraints
- `package.json` engines field - Version requirements

## Examples

<example>
Context: User wants to update all dependencies

User: "upgrade my dependencies"

Process:
1. Run analyze-deps.ts to detect 15 outdated packages
2. Categorize: 8 patch, 4 minor, 3 major
3. Auto-update 12 patch/minor packages
4. For each major (react 17→18, webpack 4→5, storybook 6→7):
   - Spawn subagent to investigate
   - Ask user for decision
5. User approves react, skips webpack, approves storybook
6. Generate report

Result: 14 packages updated, 1 skipped
</example>

<example>
Context: User only wants safe updates

User: "update dependencies but skip major versions"

Process:
1. Run analyze-deps.ts
2. Filter to patch/minor only
3. Auto-update all safe packages
4. Generate report (no user questions needed)

Result: All patch/minor updates applied
</example>

<example>
Context: Storybook group update

User: "upgrade storybook"

Process:
1. Detect all @storybook/* packages (12 packages)
2. Verify all should go to same version
3. Since major version change (6→7):
   - Spawn single subagent for the group
   - Present consolidated breaking changes
4. User approves
5. Update all 12 packages together

Result: Storybook upgraded as a group
</example>

## Notes

- Always run tests after updates when available
- Lock files (package-lock.json, pnpm-lock.yaml, yarn.lock) are regenerated automatically
- Subagents investigate concurrently for efficiency
- The AskUserQuestion tool presents major changes interactively
- Report is displayed at the end regardless of how many updates were made
