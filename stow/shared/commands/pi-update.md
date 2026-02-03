---
description: Update pi-agent and analyze extensions for breaking changes
---

# Pi Update Command

## Purpose

Updates pi-agent to the latest version, reviews the changelog for breaking changes, and analyzes local extensions for compatibility issues. Operates on the agent-config repository where extensions are stored before being stowed.

## Variables

- **version**: Optional target version (defaults to latest)

## Workflow

### Step 1: Check Current Version

```bash
pi --version
```

Store the current version for changelog comparison.

### Step 2: Update Pi-Agent

```bash
npm update -g @mariozechner/pi-coding-agent
```

Capture the new version after update.

### Step 3: Fetch and Analyze Changelog

Read the pi-agent changelog:

```bash
cat $(npm root -g)/@mariozechner/pi-coding-agent/CHANGELOG.md
```

**IF no version change**: Report "Already up to date" and stop.

**IF version changed**: Extract entries between old and new versions.

### Step 4: Identify Breaking Changes

Scan changelog entries for:

- `### Breaking Changes` sections
- `BREAKING:` prefixes
- API signature changes
- Removed features
- Changed behavior

**IF no breaking changes found**: Report update successful, skip to Step 6.

### Step 5: Analyze Extensions for Compatibility

**IF breaking changes detected**:

FOR EACH extension in `~/dev/agent-config/stow/pi/extensions/`:

1. Read the extension file
2. Check for usage of affected APIs:
   - Tool `execute()` signature changes
   - Event handler changes
   - Removed/renamed exports
   - Changed type definitions
3. Flag files needing updates
4. Suggest specific fixes based on changelog guidance

**Extension locations to check**:
- `~/dev/agent-config/stow/pi/extensions/*.ts`
- `~/dev/agent-config/stow/pi/extensions/*/index.ts`

### Step 6: Generate Report

Output summary:

```text
📦 Pi Update Report
━━━━━━━━━━━━━━━━━━━

Version: [old] → [new]

📋 Changelog Highlights:
[Key changes summary]

⚠️ Breaking Changes:
[List of breaking changes, or "None"]

🔧 Extensions Needing Updates:
[List of affected files with required changes, or "None"]

✅ Next Steps:
[Action items if any]
```

### Step 7: Apply Fixes (Interactive)

**IF extensions need updates**:

Ask user: "Would you like me to apply the suggested fixes?"

- **Yes**: Apply each fix, showing diff before/after
- **No**: Save report to `~/dev/agent-config/PI_UPDATE_REPORT.md`

## Success Criteria

- Pi-agent updated to target version
- All changelog entries reviewed
- Breaking changes identified
- Affected extensions flagged with specific remediation
- User informed of required actions

## Error Scenarios

- **npm update fails**: Check network, permissions, show error
- **Changelog not found**: Fetch from GitHub releases instead
- **Extension read fails**: Skip file, note in report
- **Version parse fails**: Use git tags as fallback

## Examples

<example>
User: "/pi-update"

Output:
📦 Pi Update Report
━━━━━━━━━━━━━━━━━━━

Version: 0.50.9 → 0.51.0

📋 Changelog Highlights:
- Extension tool signature change
- Android/Termux support
- Bash spawn hook

⚠️ Breaking Changes:
- `ToolDefinition.execute` parameter order changed:
  Before: (toolCallId, params, onUpdate, ctx, signal)
  After: (toolCallId, params, signal, onUpdate, ctx)

🔧 Extensions Needing Updates:
- extensions/web-fetch/index.ts (line 85)
- extensions/tasks/index.ts (line 142)
- extensions/subagent/index.ts (line 857)

✅ Next Steps:
1. Swap signal and onUpdate parameters in flagged files
2. Re-run install.sh to stow updated extensions
3. Reload pi with /reload
</example>

## Related Commands

- `/command:new`: Create new commands
- `/skill:new`: Create new skills

## Notes

This command helps maintain extension compatibility across pi-agent updates. Always review the suggested changes before applying them automatically.

The extension analysis focuses on the stow source directory (`~/dev/agent-config/stow/pi/extensions/`) rather than the symlinked destination, ensuring fixes are applied to the canonical source.
