#!/usr/bin/env bash
# plainly — per-turn rule reinforcement.
#
# An output style is read once, at session start, and lives in the cached system
# prompt. Over a long session adherence decays. This hook re-states the rules on
# every turn so they stay in recent context.
#
# It must stay silent unless Plainly is actually the active output style: a plugin
# hook fires whenever the plugin is ENABLED, not when the style is SELECTED, and
# injecting these rules underneath a different style would contradict it.

set -uo pipefail

STYLE_FILE="${CLAUDE_PLUGIN_ROOT:-}/output-styles/plainly.md"
[ -r "$STYLE_FILE" ] || exit 0

# Read .outputStyle out of a settings file. jq when available, sed otherwise, so
# the hook still works on machines without jq installed.
read_style() {
  local file="$1"
  [ -r "$file" ] || return 1
  local value=""
  if command -v jq >/dev/null 2>&1; then
    value="$(jq -r '.outputStyle // empty' "$file" 2>/dev/null)"
  else
    value="$(sed -n 's/.*"outputStyle"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file" | head -1)"
  fi
  [ -n "$value" ] || return 1
  printf '%s' "$value"
}

# Settings precedence: local overrides project, project overrides user.
resolve_style() {
  local project="${CLAUDE_PROJECT_DIR:-}"
  local candidate
  for candidate in \
    "${project:+$project/.claude/settings.local.json}" \
    "${project:+$project/.claude/settings.json}" \
    "$HOME/.claude/settings.json"
  do
    [ -n "$candidate" ] || continue
    if read_style "$candidate"; then
      return 0
    fi
  done
  return 1
}

if [ "${PLAINLY_REINFORCE:-0}" != "1" ]; then
  active="$(resolve_style)" || exit 0
  # Claude Code prefixes a plugin's output styles with the plugin name, so the
  # style menu saves "plainly:Plainly". A style file copied into an
  # output-styles/ directory by hand has no prefix and resolves as "Plainly".
  case "$active" in
    plainly:Plainly | Plainly) ;;
    *) exit 0 ;;
  esac
fi

# Print the rule body, stripping the YAML frontmatter. The style file is the only
# copy of the rules — this hook never holds a second one.
awk 'f; /^---$/ { c++; if (c == 2) f = 1 }' "$STYLE_FILE" | sed '/./,$!d'
