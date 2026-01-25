#!/bin/bash
# Symlink Claude Code configuration files to ~/.claude/ and additional work dirs
# Requires GNU Stow: brew install stow

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIRS_CONFIG="$HOME/.config/claude-work-dirs"

# Stow from the stow/ subdirectory, targeting ~/.claude
stow -d "$SCRIPT_DIR/stow" -t ~/.claude .
echo "Claude Code configuration linked to ~/.claude/"

# Stow to additional claude config directories from work-dirs config
if [[ -f "$WORK_DIRS_CONFIG" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

        # Extract claude config dir (after the colon)
        config_dir="${line##*:}"

        if [[ -n "$config_dir" && -d "$config_dir" ]]; then
            # Remove non-symlink settings.json if it exists (will be replaced by stow)
            [[ -f "$config_dir/settings.json" && ! -L "$config_dir/settings.json" ]] && rm "$config_dir/settings.json"
            stow -d "$SCRIPT_DIR/stow" -t "$config_dir" .
            echo "Claude Code configuration linked to $config_dir"
        fi
    done < "$WORK_DIRS_CONFIG"
fi
