#!/bin/bash
# Pre-tool-use hook for tool_call events (bash tools)
#
# Receives event JSON on stdin and via $PI_HOOK_EVENT.
# Protocol:
#   exit 0              → allow (stdout JSON optional)
#   exit 2 + stderr     → block (reason from stderr)
#   stdout JSON         → { ok, reason, decision, additionalContext }
#
# All bash command validation lives here. Add new checks as blocks.

set -euo pipefail

input="${PI_HOOK_EVENT:-$(cat)}"

tool_name=$(echo "$input" | jq -r '.toolName // empty')
command=$(echo "$input" | jq -r '.input.command // empty')

# Only inspect bash commands
if [ "$tool_name" != "bash" ] || [ -z "$command" ]; then
  exit 0
fi

# ──────────────────────────────────────────────
# CHECK: --no-verify / husky bypass
# Prevents the agent from skipping pre-commit hooks
# ──────────────────────────────────────────────

if echo "$command" | grep -qE '\bgit\b.*\s--no-verify\b'; then
  echo "Blocked: --no-verify is not allowed. Pre-commit hooks must run." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bgit\s+commit\b.*\s-[a-zA-Z]*n'; then
  echo "Blocked: git commit -n (--no-verify shorthand) is not allowed. Pre-commit hooks must run." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bHUSKY\s*=\s*0\b'; then
  echo "Blocked: HUSKY=0 disables pre-commit hooks and is not allowed." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bHUSKY_SKIP_HOOKS\s*='; then
  echo "Blocked: HUSKY_SKIP_HOOKS is not allowed. Pre-commit hooks must run." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bGIT_SKIP_HOOKS\s*='; then
  echo "Blocked: GIT_SKIP_HOOKS is not allowed. Pre-commit hooks must run." >&2
  exit 2
fi

# ──────────────────────────────────────────────
# CHECK: Dangerous / system-destroying commands
# Blocks rm -rf /, dd, mkfs, fork bombs, sudo
# ──────────────────────────────────────────────

if echo "$command" | grep -qE '\brm\s+-rf\s+/'; then
  echo "Blocked: rm -rf / would destroy entire filesystem." >&2
  exit 2
fi

if echo "$command" | grep -qE '\brm\s+-rf\s+/\*'; then
  echo "Blocked: rm -rf /* would destroy entire filesystem." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bchmod\s+(-R\s+)?777\s+/'; then
  echo "Blocked: chmod 777 / would make entire filesystem world-writable." >&2
  exit 2
fi

if echo "$command" | grep -qE '>\s*/dev/sda'; then
  echo "Blocked: writing to /dev/sda would overwrite disk." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bdd\s+if=/dev/zero'; then
  echo "Blocked: dd if=/dev/zero could overwrite critical data." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bmkfs\.'; then
  echo "Blocked: mkfs would format a filesystem." >&2
  exit 2
fi

if echo "$command" | grep -qE ':\(\)\{:\|:&\};:'; then
  echo "Blocked: fork bomb detected." >&2
  exit 2
fi

# sudo — block unless ALLOW_SUDO=1
if echo "$command" | grep -qE '(^|[;&|`]|\$\(|\))\s*sudo\s+'; then
  if [ "${ALLOW_SUDO:-}" != "1" ]; then
    echo "Blocked: sudo requires ALLOW_SUDO=1 environment variable." >&2
    exit 2
  fi
fi

# ──────────────────────────────────────────────
# CHECK: Protected branches
# Blocks direct commits/merges/rebases on main/master/prod,
# force push, and protected branch deletion.
# Configurable via PROTECTED_BRANCHES env var (comma-separated).
# ──────────────────────────────────────────────

PROTECTED_BRANCHES="${PROTECTED_BRANCHES:-main,master,prod}"
IFS=',' read -ra BRANCHES <<< "$PROTECTED_BRANCHES"

# Only check git commands for branch protection
if echo "$command" | grep -qE '^\s*git\s+'; then

  # Force push — always blocked
  if echo "$command" | grep -qE '\bgit\s+push\b.*--force\b' || \
     echo "$command" | grep -qE '\bgit\s+push\b.*\s-[a-zA-Z]*f'; then
    echo "Blocked: force push is dangerous. Use regular push or create a new branch." >&2
    exit 2
  fi

  # Get current branch for on-branch checks
  current_branch=""
  if command -v git &>/dev/null; then
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  fi

  for branch in "${BRANCHES[@]}"; do
    branch=$(echo "$branch" | xargs) # trim whitespace

    # Checks when ON a protected branch
    if [ "$current_branch" = "$branch" ]; then
      if echo "$command" | grep -qE '\bgit\s+commit\b'; then
        echo "Blocked: direct commits to '$branch'. Create a feature branch first: git checkout -b feature/your-branch" >&2
        exit 2
      fi
      if echo "$command" | grep -qE '\bgit\s+merge\b'; then
        echo "Blocked: direct merge into '$branch'. Use pull requests instead." >&2
        exit 2
      fi
      if echo "$command" | grep -qE '\bgit\s+rebase\b'; then
        echo "Blocked: rebase on protected branch '$branch'." >&2
        exit 2
      fi
      if echo "$command" | grep -qE '\bgit\s+reset\b.*--hard'; then
        echo "Blocked: hard reset on protected branch '$branch'." >&2
        exit 2
      fi
    fi

    # Checks targeting protected branches by name
    if echo "$command" | grep -qE "\\bgit\\s+push\\s+\\S+\\s+(\\S+:)?${branch}(\\s|\$)"; then
      echo "Blocked: direct push to protected branch '$branch'. Use pull requests." >&2
      exit 2
    fi
    if echo "$command" | grep -qE "\\bgit\\s+branch\\s+.*-[dD]\\s+.*${branch}"; then
      echo "Blocked: deleting protected branch '$branch'." >&2
      exit 2
    fi
  done
fi

# ──────────────────────────────────────────────
# CHECK: Secrets access
# Blocks direct reads from Keychain and 1Password.
# Secrets should be injected via opchain/varlock, not read directly.
# ──────────────────────────────────────────────

if echo "$command" | grep -qE '\bsecurity\s+find-generic-password\b'; then
  echo "Blocked: security find-generic-password would expose Keychain secrets. Use opchain instead." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bsecurity\s+dump-keychain\b'; then
  echo "Blocked: security dump-keychain would expose Keychain contents." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bop\s+read\b'; then
  echo "Blocked: op read would expose 1Password secrets. Use opchain --read instead." >&2
  exit 2
fi

if echo "$command" | grep -qE '\bop\s+item\s+get\b'; then
  echo "Blocked: op item get would expose 1Password secrets. Use opchain instead." >&2
  exit 2
fi

if echo "$command" | grep -qE 'OP_SERVICE_ACCOUNT_TOKEN'; then
  echo "Blocked: accessing OP_SERVICE_ACCOUNT_TOKEN directly is not allowed." >&2
  exit 2
fi

# ──────────────────────────────────────────────
# CHECK: GitHub CLI protection
# Blocks destructive gh operations: repo delete, merge --admin,
# dangerous API calls, release/workflow deletion.
# ──────────────────────────────────────────────

if echo "$command" | grep -qE '^\s*gh\s+'; then

  # Strip quoted content to avoid false positives on PR body text
  cmd_stripped=$(echo "$command" | sed -E 's/"[^"]*"/""/g; s/'"'"'[^'"'"']*'"'"'/'"''"'/g')

  if echo "$cmd_stripped" | grep -qE '\bgh\s+repo\s+delete\b'; then
    echo "Blocked: gh repo delete is not allowed." >&2
    exit 2
  fi

  if echo "$cmd_stripped" | grep -qE '\bgh\s+pr\s+merge\b.*--admin'; then
    echo "Blocked: gh pr merge --admin bypasses branch protection." >&2
    exit 2
  fi

  if echo "$cmd_stripped" | grep -qE '\bgh\s+api\b.*(-X|--method)\s+DELETE.*(branches|/repos/)'; then
    echo "Blocked: gh API DELETE to branches/repos is not allowed." >&2
    exit 2
  fi

  if echo "$cmd_stripped" | grep -qE '\bgh\s+api\b.*branches/.*/protection'; then
    echo "Blocked: gh API calls to branch protection endpoints are not allowed." >&2
    exit 2
  fi

  if echo "$cmd_stripped" | grep -qE '\bgh\s+release\s+delete\b'; then
    echo "Blocked: gh release delete is not allowed." >&2
    exit 2
  fi

  if echo "$cmd_stripped" | grep -qE '\bgh\s+workflow\s+disable\b'; then
    echo "Blocked: gh workflow disable is not allowed." >&2
    exit 2
  fi
fi

# All checks passed
exit 0
