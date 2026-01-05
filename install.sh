#!/bin/bash
# Symlink Claude Code configuration files to ~/.claude/
# Requires GNU Stow: brew install stow

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Stow from the stow/ subdirectory, targeting ~/.claude
stow -d "$SCRIPT_DIR/stow" -t ~/.claude .

echo "Claude Code configuration linked to ~/.claude/"
