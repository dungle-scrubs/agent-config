#!/bin/bash
# Symlink Claude Code, Codex, and Pi configuration files
# Requires GNU Stow: brew install stow

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# === Claude Code ===
# Stow claude-code specific files
stow -d "$SCRIPT_DIR/stow/claude-code" -t ~/.claude .

# Symlink shared resources
ln -sf "$SCRIPT_DIR/stow/shared/instructions.md" ~/.claude/CLAUDE.md
ln -sf "$SCRIPT_DIR/stow/shared/commands" ~/.claude/commands
ln -sf "$SCRIPT_DIR/stow/shared/skills" ~/.claude/skills

echo "Claude Code configuration linked to ~/.claude/"

# === Codex ===
mkdir -p ~/.codex
stow -d "$SCRIPT_DIR/stow/codex" -t ~/.codex .

# Codex doesn't support root AGENT.md - manual init per project
ln -sf "$SCRIPT_DIR/stow/shared/commands" ~/.codex/commands
ln -sf "$SCRIPT_DIR/stow/shared/skills" ~/.codex/skills

echo "Codex configuration linked to ~/.codex/"

# === Pi ===
mkdir -p ~/.pi
# Remove existing non-symlink files that conflict with stow
if [[ -d ~/.pi/agent && ! -L ~/.pi/agent ]]; then
    # Backup sessions/auth if they exist (runtime data)
    [[ -d ~/.pi/agent/sessions ]] && mv ~/.pi/agent/sessions /tmp/pi-sessions-backup 2>/dev/null || true
    [[ -f ~/.pi/agent/auth.json ]] && mv ~/.pi/agent/auth.json /tmp/pi-auth-backup.json 2>/dev/null || true
    # Remove the agent dir to allow stow
    rm -rf ~/.pi/agent
fi
stow -d "$SCRIPT_DIR/stow/pi" -t ~/.pi .
# Restore runtime data
[[ -d /tmp/pi-sessions-backup ]] && mv /tmp/pi-sessions-backup ~/.pi/agent/sessions 2>/dev/null || true
[[ -f /tmp/pi-auth-backup.json ]] && mv /tmp/pi-auth-backup.json ~/.pi/agent/auth.json 2>/dev/null || true

echo "Pi configuration linked to ~/.pi/"

# === Additional work dirs (Claude Code only) ===
WORK_DIRS_CONFIG="$HOME/.config/claude-work-dirs"
if [[ -f "$WORK_DIRS_CONFIG" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

        # Extract claude config dir (after the colon)
        config_dir="${line##*:}"

        if [[ -n "$config_dir" && -d "$config_dir" ]]; then
            # Remove non-symlink settings.json if it exists (will be replaced by stow)
            [[ -f "$config_dir/settings.json" && ! -L "$config_dir/settings.json" ]] && rm "$config_dir/settings.json"
            stow -d "$SCRIPT_DIR/stow/claude-code" -t "$config_dir" .
            ln -sf "$SCRIPT_DIR/stow/shared/instructions.md" "$config_dir/CLAUDE.md"
            ln -sf "$SCRIPT_DIR/stow/shared/commands" "$config_dir/commands"
            ln -sf "$SCRIPT_DIR/stow/shared/skills" "$config_dir/skills"
            echo "Claude Code configuration linked to $config_dir"
        fi
    done < "$WORK_DIRS_CONFIG"
fi
