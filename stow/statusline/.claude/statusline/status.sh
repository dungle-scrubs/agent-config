#!/bin/bash
# Custom Claude Code status line
# Segments: model | folder | git | context % | tokens | tool-proxy

# Read JSON from stdin
JSON=$(cat)

# Colors (256-color mode)
C_ORANGE="\033[38;5;208m"
C_OLIVE="\033[38;5;142m"
C_TEAL="\033[38;5;109m"
C_PURPLE="\033[38;5;176m"
C_GREEN="\033[38;5;114m"
C_YELLOW="\033[38;5;214m"
C_RED="\033[38;5;203m"
C_GRAY="\033[38;5;245m"
C_RESET="\033[0m"

# === Segment 1: Model ===
MODEL=$(echo "$JSON" | jq -r '.model.display_name // "?"' 2>/dev/null || echo "?")
SEG_MODEL="${C_ORANGE}󰘧 ${MODEL}${C_RESET}"

# === Segment 2: Folder ===
CWD=$(echo "$JSON" | jq -r '.cwd // "?"' 2>/dev/null || echo "?")
FOLDER=$(basename "$CWD")
SEG_FOLDER="${C_OLIVE}󰉋 ${FOLDER}${C_RESET}"

# === Segment 3: Git branch + status ===
BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "")
if [[ -n "$BRANCH" ]]; then
  DIRTY=""
  if [[ -n $(git -C "$CWD" status --porcelain 2>/dev/null) ]]; then
    DIRTY=" ●"
  fi
  SEG_GIT="${C_TEAL}󰊢 ${BRANCH}${DIRTY}${C_RESET}"
else
  SEG_GIT=""
fi

# === Segment 4+5: Context window % and tokens ===
CTX_CURRENT=$(echo "$JSON" | jq -r '.context_window.total_input_tokens // 0' 2>/dev/null || echo "0")
CTX_PCT=$(echo "$JSON" | jq -r '.context_window.used_percentage // 0' 2>/dev/null || echo "0")
CTX_TOKENS=$(awk "BEGIN {printf \"%.1fk\", $CTX_CURRENT / 1000}")

# Pick icon based on percentage (7 stages)
if [[ $CTX_PCT -lt 15 ]]; then
  CTX_ICON="󰝦"
elif [[ $CTX_PCT -lt 30 ]]; then
  CTX_ICON="󰪞"
elif [[ $CTX_PCT -lt 45 ]]; then
  CTX_ICON="󰪟"
elif [[ $CTX_PCT -lt 60 ]]; then
  CTX_ICON="󰪠"
elif [[ $CTX_PCT -lt 75 ]]; then
  CTX_ICON="󰪡"
elif [[ $CTX_PCT -lt 90 ]]; then
  CTX_ICON="󰪢"
else
  CTX_ICON="󰪣"
fi
SEG_CTX="${C_PURPLE}${CTX_ICON} ${CTX_PCT}% · ${CTX_TOKENS}${C_RESET}"

# === Segment 6: Tool-proxy connection ===
STATE_FILE="/tmp/tool-proxy-state.json"
if [[ -f "$STATE_FILE" ]]; then
  TP_STATE=$(jq -r '.state // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")
  TP_TS=$(jq -r '.timestamp // 0' "$STATE_FILE" 2>/dev/null || echo "0")
  TP_PID=$(jq -r '.pid // 0' "$STATE_FILE" 2>/dev/null || echo "0")
  NOW_MS=$(($(date +%s) * 1000))
  AGE_SEC=$(( (NOW_MS - TP_TS) / 1000 ))

  # Validate PID is still running
  PID_ALIVE=false
  if [[ "$TP_PID" -gt 0 ]] && kill -0 "$TP_PID" 2>/dev/null; then
    PID_ALIVE=true
  fi

  # If PID dead but file was modified recently (<10s), trust state (startup race condition)
  FILE_AGE_SEC=$(( $(date +%s) - $(stat -f %m "$STATE_FILE") ))
  FRESH_FILE=false
  if [[ $FILE_AGE_SEC -lt 10 ]]; then
    FRESH_FILE=true
  fi

  # Use state if PID alive OR file is fresh (startup race)
  if [[ "$PID_ALIVE" == "false" && "$FRESH_FILE" == "false" ]]; then
    SEG_TP="${C_GRAY}󰿘 ○${C_RESET}"
  else
    case "$TP_STATE" in
      connecting)
        if [[ $AGE_SEC -gt 30 ]]; then
          SEG_TP="${C_RED}󰿘 󰅖${C_RESET}"  # stuck connecting = dead
        else
          SEG_TP="${C_YELLOW}󰿘 󰦖${C_RESET}"
        fi ;;
      connected)
        SEG_TP="${C_GREEN}󰿘 󰄬${C_RESET}" ;;
      error)
        SEG_TP="${C_RED}󰿘 󰅖${C_RESET}" ;;
      disconnected)
        SEG_TP="${C_RED}󰿘 󰅖${C_RESET}" ;;
      *)
        SEG_TP="${C_GRAY}󰿘 ?${C_RESET}" ;;
    esac
  fi
else
  SEG_TP="${C_GRAY}󰿘 ○${C_RESET}"
fi

# Fallback if SEG_TP somehow empty
[[ -z "$SEG_TP" ]] && SEG_TP="${C_GRAY}󰿘 ?${C_RESET}"

# Output
SEGMENTS="$SEG_MODEL | $SEG_FOLDER"
[[ -n "$SEG_GIT" ]] && SEGMENTS="$SEGMENTS | $SEG_GIT"
SEGMENTS="$SEGMENTS | $SEG_CTX | $SEG_TP"
echo -e "$SEGMENTS"
