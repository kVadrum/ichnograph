#!/usr/bin/env bash
# Wrapper invoked by the systemd user timer. Fires one headless Claude Code
# session against ichnograph using the prompt at $PROJECT/ops/prompt.md, on
# the fleet's rig model and effort (ops/tools/rig-model.sh). All output
# appended to ${LOG_DIR:-$HOME/logs}.

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

# Canonical model + effort for all rigs (RIG_MODEL / RIG_EFFORT; override by
# exporting either first). Sourced through $HOME like push-probe.sh below, so
# this public repo names no host path. If it cannot be read, RIG_MODEL is unset
# and `set -u` stops the run at the launch below, red, rather than on a
# pinned model that goes stale (it read claude-opus-4-7 at high until
# 2026-11-06).
. "$HOME/dev/ops/tools/rig-model.sh"

{
  echo "===== $(ts) START ichnograph-daily ====="
  echo "cwd: $PROJECT"
  echo "model: ${RIG_MODEL:-UNSET}  effort: ${RIG_EFFORT:-UNSET}"
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
  --model "$RIG_MODEL" \
  --effort "$RIG_EFFORT" \
  --permission-mode acceptEdits \
  --output-format text \
  "$(cat "$PROMPT")" \
  >>"$LOG" 2>&1

rc=$?

# Push any commits the agent just made.
update_push_state || true

echo "===== $(ts) END ichnograph-daily rc=$rc =====" >>"$LOG"
exit "$rc"
