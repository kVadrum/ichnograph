#!/usr/bin/env bash
# Wrapper invoked by the systemd user timer. Fires an Opus 4.7 headless
# Claude Code session against ichnograph using the prompt at
# $PROJECT/ops/prompt.md. All output appended to ${LOG_DIR:-$HOME/logs}.
#
# Move-from-claude-expo note (2026-05-19): this file used to live at
# claude-expo/ops/run-ichnograph-daily.sh as a cross-project leftover
# from before ichnograph had its own repo with its own ops/. The user
# systemd unit `ichnograph-daily.service` needs ExecStart updated to
# point at the new path:
#   ExecStart=%h/dev/projects/ichnograph/ops/run-tonight.sh
# After updating: `systemctl --user daemon-reload`.

set -uo pipefail

# Project root derived from script location — no hardcoded host paths.
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT="$PROJECT/ops/prompt.md"
LOG="${LOG_DIR:-$HOME/logs}/ichnograph-daily.log"
CLAUDE="${CLAUDE_BIN:-$(command -v claude)}"

mkdir -p "$(dirname "$LOG")"

# Signal to the guardrails hook that we are in a non-interactive
# session — any "ask" decision cannot be prompted, so the hook
# converts ask → deny.
export CLAUDE_HEADLESS=1
export CLAUDE_PROJECT_DIR="$PROJECT"

# Load nvm's default node onto PATH so the agent can run `npm test`
# and `npm run build`. Systemd's user environment does not inherit
# interactive shell rc files, so the node/npm binaries must be put on
# PATH explicitly. Using nvm (not a hardcoded versioned path) survives
# node upgrades — `nvm use default` resolves whatever version is current.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  nvm use default >/dev/null 2>&1 || true
fi

ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }

{
  echo "===== $(ts) START ichnograph-daily ====="
  echo "cwd: $PROJECT"
  echo "model: claude-opus-4-7  effort: high"
  echo "node: $(command -v node || echo MISSING)  npm: $(command -v npm || echo MISSING)"
} >>"$LOG"

cd "$PROJECT" || { echo "$(ts) FATAL: cannot cd to $PROJECT" >>"$LOG"; exit 1; }

# Wrapper owns all `git push origin dev` calls — agent never pushes.
# See ~/dev/ops/tools/push-probe.sh for protocol details. Ichnograph has
# no `ops/autonomous/` subdir (its rig predates that layout), so the
# sentinel lives at `ops/.push-broken`.
PUSH_SENTINEL="$PROJECT/ops/.push-broken"
. "$HOME/dev/ops/tools/push-probe.sh"

update_push_state || true

"$CLAUDE" \
  --print \
  --model claude-opus-4-7 \
  --effort high \
  --permission-mode acceptEdits \
  --output-format text \
  "$(cat "$PROMPT")" \
  >>"$LOG" 2>&1

rc=$?

# Push any commits the agent just made.
update_push_state || true

echo "===== $(ts) END ichnograph-daily rc=$rc =====" >>"$LOG"
exit "$rc"
