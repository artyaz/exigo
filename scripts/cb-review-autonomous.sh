#!/usr/bin/env bash
# scripts/cb-review-autonomous.sh
#
# Headless entry point for the cb-review loop. Designed to run in a sealed
# environment with no human in the loop. See agents/cd-review/LOOP.md §0.5
# for the full protocol.
#
# Responsibilities of THIS script (intentionally thin — agent owns the work):
#   1. Resolve RUN_ROOT (today's date or --date YYYY-MM-DD or --resume).
#   2. Detect harness capabilities (subagent spawn, CLI peer spawn).
#   3. Decide orchestration mode: cli_layer (launcher + day-scope peer) or
#      single_agent (in-process subagents only).
#   4. Spawn the agent(s) with a self-contained brief that references
#      LOOP.md as the single source of truth.
#   5. Supervise: re-wake crashed/stalled day-scope agents until the loop
#      reaches a terminal state (complete | fatal_blocked) or the wall-clock
#      budget is exhausted.
#   6. Exit non-zero on fatal blocks so the host scheduler (cron / systemd
#      / CI) can alert or restart cleanly.
#
# This script does NOT implement the wave logic itself — that lives in
# LOOP.md so the agent can adapt it without a script redeploy.
#
# Usage:
#   cb-review-autonomous.sh                      # today, fresh or resume
#   cb-review-autonomous.sh --date 2026-07-24    # specific date
#   cb-review-autonomous.sh --resume             # latest dated run
#   cb-review-autonomous.sh --scope "wave14"     # hint for orchestrator
#   cb-review-autonomous.sh --max-runtime 43200  # 12h wall-clock cap (seconds)
#   cb-review-autonomous.sh --max-wakeups 8      # cap on re-spawn attempts
#
# Exit codes:
#   0  loop reached a terminal `complete` state (or `fatal_blocked` was
#      acknowledged via --allow-fatal)
#   1  fatal blocked (day-status.json state=fatal_blocked) — needs human
#   2  harness misconfiguration (no agent CLI found, no auth, etc.)
#   3  wall-clock or wakeup budget exhausted with no terminal state
#   4  script bug (unhandled error)

set -Eeuo pipefail

# ERR trap: produce a consistent exit code 4 for any unhandled command
# failure. Without this, `set -e` just propagates the failing command's
# own status (or bash's abort code for nounset violations), so a host
# scheduler cannot distinguish "script bug" from "fatal blocked" (1) or
# "budget exhausted" (3). The trap is inherited by functions and
# subshells thanks to `set -E`.
trap 'echo "[cb-review] FATAL: unhandled error on line $LINENO (exit $?)" >&2; exit 4' ERR

# ---------------------------------------------------------------------------
# 0. Defaults & arg parsing
# ---------------------------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DATE_ARG=""
SCOPE_HINT=""
MAX_RUNTIME=43200      # 12 hours; matches a single day-scope context budget
MAX_WAKEUPS=8
ALLOW_FATAL=0
AGENT_BIN_OVERRIDE=""
EXTRA_AGENT_FLAGS=()

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
  exit 2
}

# Helper: require a value for a flag that takes one. Under `set -u` a bare
# trailing `--date` would otherwise abort with an opaque "unbound variable".
require_arg() {
  local flag="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "error: $flag requires a value" >&2
    usage
  fi
}

# Helper: validate that a value is a non-negative integer. Prevents the
# wakeup/wall-clock budget guards from silently misbehaving when a non-numeric
# value is passed (bash `[[ -gt ]]` prints "integer expression expected" and
# then evaluates the if as false, disabling the guard instead of failing).
require_int() {
  local flag="$1" value="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "error: $flag requires a non-negative integer, got: $value" >&2
    usage
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date)         require_arg "$1" "${2:-}"; DATE_ARG="$2"; shift 2 ;;
    --resume)       DATE_ARG="__resume__"; shift ;;
    --scope)        require_arg "$1" "${2:-}"; SCOPE_HINT="$2"; shift 2 ;;
    --max-runtime)  require_arg "$1" "${2:-}"; require_int "$1" "$2"; MAX_RUNTIME="$2"; shift 2 ;;
    --max-wakeups)  require_arg "$1" "${2:-}"; require_int "$1" "$2"; MAX_WAKEUPS="$2"; shift 2 ;;
    --allow-fatal)  ALLOW_FATAL=1; shift ;;
    --agent-bin)    require_arg "$1" "${2:-}"; AGENT_BIN_OVERRIDE="$2"; shift 2 ;;
    --agent-flag)   require_arg "$1" "${2:-}"; EXTRA_AGENT_FLAGS+=("$2"); shift 2 ;;
    -h|--help)      usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Resolve RUN_ROOT
# ---------------------------------------------------------------------------

CD_REVIEW_DIR="$REPO_ROOT/agents/cd-review"

if [[ "$DATE_ARG" == "" ]]; then
  RUN_DATE="$(date -u +%Y-%m-%d)"
elif [[ "$DATE_ARG" == "__resume__" ]]; then
  # Pick the most recent dated dir whose day-status.json is NOT in a
  # terminal state. Skip complete/fatal_blocked dirs so we never re-enter a
  # finished day and risk mutating its artifacts (LOOP.md §0.5: "Artifacts
  # are truth"). If every prior run is terminal, fall through to today.
  RUN_DATE=""
  while IFS= read -r -d '' dir; do
    dir_date="$(basename "$dir")"
    status_file="$dir/audits/day-status.json"
    if [[ ! -f "$status_file" ]]; then
      # No status file → never started or pre-status contract; eligible.
      RUN_DATE="$dir_date"
      break
    fi
    state="$(python3 -c "import json,sys
try:
    print(json.load(open('$status_file')).get('state',''))
except Exception:
    sys.exit(0)
" 2>/dev/null || true)"
    case "$state" in
      complete|fatal_blocked)
        # Terminal — keep scanning older dirs.
        continue
        ;;
      *)
        RUN_DATE="$dir_date"
        break
        ;;
    esac
  done < <(find "$CD_REVIEW_DIR" -maxdepth 1 -mindepth 1 \
            -type d -name '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' \
            -printf '%p\0' 2>/dev/null | sort -rz)

  if [[ -z "$RUN_DATE" ]]; then
    echo "[cb-review] no prior non-terminal dated run found; starting fresh for today" >&2
    RUN_DATE="$(date -u +%Y-%m-%d)"
  else
    echo "[cb-review] --resume picked run: $RUN_DATE"
  fi
else
  RUN_DATE="$DATE_ARG"
fi

RUN_ROOT="$CD_REVIEW_DIR/$RUN_DATE"
mkdir -p "$RUN_ROOT/audits/slices" "$RUN_ROOT/audits/fixes" \
         "$RUN_ROOT/audits/pre-pr" "$RUN_ROOT/brainstorms"

STATUS_FILE="$RUN_ROOT/audits/day-status.json"
RECORD="$RUN_ROOT/RECORD.md"

echo "[cb-review] RUN_ROOT=$RUN_ROOT"
echo "[cb-review] STATUS_FILE=$STATUS_FILE"

# ---------------------------------------------------------------------------
# 2. Harness capability detection
# ---------------------------------------------------------------------------
#
# The loop supports two orchestration modes:
#
#   cli_layer:      a launcher process spawns a separate day-scope agent
#                   process (peer, not subagent). The launcher polls
#                   day-status.json and re-wakes the peer on crash/stall.
#                   Requires: an agent CLI that can run headless with a
#                   prompt and a cwd, and that has its own subagent
#                   primitive (so the day-scope agent can fan out Wave A/B/C/D).
#
#   single_agent:   one agent process owns everything. It runs the loop
#                   end-to-end using only its in-process subagent primitive
#                   for waves. No peer process. Used when:
#                     - no agent CLI is available (we were spawned BY an
#                       agent, so we ARE the day-scope agent), or
#                     - the CLI cannot run headless / cannot be backgrounded
#                       from inside a sealed environment, or
#                     - --agent-bin was explicitly set to "self".
#
# Detection order:
#   a. If AGENT_BIN_OVERRIDE is set and != "self", use it (cli_layer).
#   b. Else if $AGENT_BIN env var is set, use it (cli_layer).
#   c. Else probe for common agent CLIs (grok, claude, codex, aider, …).
#   d. Else assume we are already running inside an agent that has its own
#      subagent primitive → single_agent mode. Emit a marker file so the
#      agent reads the right section of LOOP.md.

detect_agent_cli() {
  if [[ -n "$AGENT_BIN_OVERRIDE" ]]; then
    if [[ "$AGENT_BIN_OVERRIDE" == "self" ]]; then
      echo "self"
      return
    fi
    if command -v "$AGENT_BIN_OVERRIDE" >/dev/null 2>&1; then
      echo "$AGENT_BIN_OVERRIDE"
      return
    fi
    echo "agent bin not found: $AGENT_BIN_OVERRIDE" >&2
    return 1
  fi
  if [[ -n "${AGENT_BIN:-}" ]] && command -v "$AGENT_BIN" >/dev/null 2>&1; then
    echo "$AGENT_BIN"
    return
  fi
  for cand in grok claude codex aider gemini opencode; do
    if command -v "$cand" >/dev/null 2>&1; then
      echo "$cand"
      return
    fi
  done
  echo "self"
}

AGENT_CLI="$(detect_agent_cli || true)"
if [[ "$AGENT_CLI" == "self" ]]; then
  MODE="single_agent"
else
  MODE="cli_layer"
fi

echo "[cb-review] AGENT_CLI=$AGENT_CLI  MODE=$MODE"

# Sanity: in cli_layer mode the agent CLI must actually exist.
if [[ "$MODE" == "cli_layer" ]] && ! command -v "$AGENT_CLI" >/dev/null 2>&1; then
  echo "FATAL: cli_layer mode selected but '$AGENT_CLI' is not on PATH" >&2
  exit 2
fi

# Write a mode marker that LOOP.md §0.5 tells the agent to read.
# Emit via python3 so all string fields are JSON-escaped (SCOPE_HINT is
# arbitrary CLI input — `--scope 'wave "14"'` would otherwise produce
# invalid JSON and break every downstream parser, including our own
# read_status_field consumer).
if command -v python3 >/dev/null 2>&1; then
  python3 -c "
import json
d = {
    'mode': '$MODE',
    'agent_cli': '$AGENT_CLI',
    'max_runtime_seconds': $MAX_RUNTIME,
    'max_wakeups': $MAX_WAKEUPS,
    'scope_hint': $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$SCOPE_HINT"),
    'detected_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
}
with open('$RUN_ROOT/audits/harness-mode.json', 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\\n')
"
else
  # Fallback: minimal escaping (backslash + double-quote only). Sufficient
  # for typical scope hints; python3 path above is preferred.
  esc_scope="${SCOPE_HINT//\\/\\\\}"
  esc_scope="${esc_scope//\"/\\\"}"
  cat > "$RUN_ROOT/audits/harness-mode.json" <<EOF
{
  "mode": "$MODE",
  "agent_cli": "$AGENT_CLI",
  "max_runtime_seconds": $MAX_RUNTIME,
  "max_wakeups": $MAX_WAKEUPS,
  "scope_hint": "$esc_scope",
  "detected_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
fi

# ---------------------------------------------------------------------------
# 3. Build the agent brief
# ---------------------------------------------------------------------------
#
# The brief is intentionally short — LOOP.md is the source of truth. We just
# pin RUN_ROOT, MODE, scope, stop conditions, and the "no human" rule.

SCOPE_LINE=""
[[ -n "$SCOPE_HINT" ]] && SCOPE_LINE="SCOPE_HINT: $SCOPE_HINT"

read -r -d '' AGENT_BRIEF <<EOF || true
You are the cd-review agent for Exigo.
Read and obey agents/cd-review/LOOP.md IN FULL before doing anything else.
Then read agents/cd-review/REVIEW-LENS.md (Wave D reviewer catalogue).
Then read AGENTS.md and .coderabbit.yaml (conventions you enforce).

RUN_ROOT=$RUN_ROOT
RUN_DATE=$RUN_DATE
MODE=$MODE
$SCOPE_LINE

CRITICAL RULES
- NO HUMAN IN THE LOOP. Do not pause to ask "should I continue?". Do not
  print "waiting for user" and stop. Either continue, ship, or set
  day-status.json state=fatal_blocked with a precise blocked_reason and
  exit non-zero.
- Artifacts are truth. Keep RECORD.md and audits/day-status.json current
  after every material step (wave start/end, ship step, PR open/merge,
  block). A cold resume must be possible from these two files alone.
- Obey §10.2 ship protocol: seed → land develop → PR main → Wave D
  pre-PR review → sleep 5m → fetch CodeRabbit → 10m if pending → fix →
  push → repeat ≤3 rounds → merge main.
- Obey §10.5 exit conditions: complete | fatal_blocked | budget_exhausted.
- Update day-status.json to one of: running | shipping | waiting_coderabbit
  | blocked | fatal_blocked | complete | budget_exhausted. Never leave it
  on "running" when you exit.

START
1. If $STATUS_FILE does not exist or state is complete/fatal_blocked and
   this is a fresh run: scaffold per LOOP.md §1 (RECORD.md, slices.md).
2. If $STATUS_FILE exists with state in {running, shipping,
   waiting_coderabbit, blocked, budget_exhausted}: this is a RESUME.
   Read RECORD.md "Stopped at" + day-status.json last_step and continue
   from there. Do NOT re-run waves that already shipped.
3. Run the loop autonomously until a terminal state per §10.5.
EOF

# ---------------------------------------------------------------------------
# 4. Spawn function (mode-specific)
# ---------------------------------------------------------------------------

# All agent CLIs we support take a prompt on stdin or as -p, run headless,
# and exit with the agent's exit code. --yolo / --dangerously-skip-perms
# style flags are passed via EXTRA_AGENT_FLAGS so the caller controls them.
spawn_agent() {
  # Returns:
  #   0  agent invocation succeeded (agent may still have exited non-zero
  #      — that's a real run outcome, not a spawn failure; the supervise
  #      loop reads day-status.json to classify it)
  #   2  harness misconfiguration (unknown CLI, binary not on PATH, or no
  #      spawn case matched) — these are hard fails; do NOT silently retry
  #      as if the agent had run
  #
  # The previous version conflated "couldn't invoke the CLI" with "the CLI
  # ran and exited non-zero". The brief instructs the agent to exit non-zero
  # on fatal_blocked (line 212), so treating non-zero as a spawn failure
  # silently re-spawned with a stale brief instead of surfacing the block.
  local wake_num="$1"
  local log_file="$RUN_ROOT/audits/agent-wake-${wake_num}.log"
  echo "[cb-review] spawning wake #$wake_num → $log_file"

  # Verify the CLI binary exists for all non-self modes. This is the only
  # path that should return 2 from spawn_agent (config error, not run error).
  if [[ "$AGENT_CLI" != "self" ]] && ! command -v "$AGENT_CLI" >/dev/null 2>&1; then
    echo "FATAL: AGENT_CLI='$AGENT_CLI' is not on PATH" >&2
    return 2
  fi

  local rc=0
  case "$AGENT_CLI" in
    self)
      # We are already inside an agent with a subagent primitive. Drop a
      # marker file the host agent's wrapper is expected to pick up, then
      # exit so the wrapper can hand the brief to its own subagent spawn.
      # (In test/CI contexts where there is no wrapper, this branch is a
      # no-op: the caller is expected to invoke LOOP.md directly.)
      echo "$AGENT_BRIEF" > "$RUN_ROOT/audits/pending-brief.txt"
      echo "[cb-review] MODE=single_agent: brief written to \
$RUN_ROOT/audits/pending-brief.txt — hand off to your agent's subagent spawn."
      return 0
      ;;
    grok)
      echo "$AGENT_BRIEF" | "$AGENT_CLI" -p "$(cat)" \
        --cwd "$REPO_ROOT" --output-format json --yolo \
        "${EXTRA_AGENT_FLAGS[@]}" >"$log_file" 2>&1 || rc=$?
      ;;
    claude)
      echo "$AGENT_BRIEF" | "$AGENT_CLI" -p "$(cat)" \
        --cwd "$REPO_ROOT" --output-format json --dangerously-skip-permissions \
        "${EXTRA_AGENT_FLAGS[@]}" >"$log_file" 2>&1 || rc=$?
      ;;
    codex|aider|gemini|opencode)
      # Generic headless invocation; adjust per CLI as needed.
      echo "$AGENT_BRIEF" | "$AGENT_CLI" --cwd "$REPO_ROOT" \
        "${EXTRA_AGENT_FLAGS[@]}" >"$log_file" 2>&1 || rc=$?
      ;;
    *)
      echo "FATAL: no spawn case for AGENT_CLI=$AGENT_CLI" >&2
      return 2
      ;;
  esac

  # The agent ran. Whether it exited 0 or non-zero, the supervise loop must
  # now inspect day-status.json to classify the outcome (terminal / blocked /
  # transient). Returning 0 here does NOT mean "success" — it means
  # "invocation succeeded; classify via status file".
  if [[ "$rc" -ne 0 ]]; then
    echo "[cb-review] wake #$wake_num: agent exited non-zero (rc=$rc) — will classify via day-status.json" >&2
  fi
  return 0
}

# ---------------------------------------------------------------------------
# 5. Status helpers
# ---------------------------------------------------------------------------

read_status_field() {
  # $1 = field name. Returns value or empty string. Tolerates missing file.
  [[ -f "$STATUS_FILE" ]] || return 0
  # Use python3 if available for robust JSON; fall back to grep.
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json, sys
try:
    d = json.load(open('$STATUS_FILE'))
except Exception:
    sys.exit(0)
v = d.get('$1')
if v is not None:
    print(v)
" 2>/dev/null
  else
    grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$STATUS_FILE" \
      | head -1 | sed -E 's/.*: *"(.*)"/\1/'
  fi
}

is_terminal_state() {
  local s
  s="$(read_status_field state || true)"
  case "$s" in
    complete|fatal_blocked) return 0 ;;
    *) return 1 ;;
  esac
}

is_blocked_state() {
  local s
  s="$(read_status_field state || true)"
  case "$s" in
    blocked|fatal_blocked|budget_exhausted) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# 6. Supervise: spawn / re-wake loop
# ---------------------------------------------------------------------------

START_EPOCH="$(date +%s)"
WAKE_NUM=0

while true; do
  WAKE_NUM=$((WAKE_NUM + 1))

  if [[ "$WAKE_NUM" -gt "$MAX_WAKEUPS" ]]; then
    echo "[cb-review] wakeup budget exhausted ($MAX_WAKEUPS); exiting 3" >&2
    # Leave day-status as-is so a later run can resume.
    exit 3
  fi

  NOW_EPOCH="$(date +%s)"
  ELAPSED=$((NOW_EPOCH - START_EPOCH))
  if [[ "$ELAPSED" -ge "$MAX_RUNTIME" ]]; then
    echo "[cb-review] wall-clock budget exhausted (${ELAPSED}s ≥ ${MAX_RUNTIME}s); exiting 3" >&2
    # Mark budget_exhausted so the next run knows to resume rather than restart.
    if [[ -f "$STATUS_FILE" ]] && command -v python3 >/dev/null 2>&1; then
      python3 -c "
import json
d = json.load(open('$STATUS_FILE'))
d['state'] = 'budget_exhausted'
d['updated_at'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
json.dump(d, open('$STATUS_FILE','w'), indent=2)
"
    fi
    exit 3
  fi

  # Spawn (or re-spawn) the agent. spawn_agent returns:
  #   0  invocation succeeded (agent ran and exited, possibly non-zero —
  #      classify via day-status.json below)
  #   2  harness misconfiguration (unknown CLI, binary missing) — hard fail,
  #      no point retrying with the same config
  #
  # NOTE: we run spawn_agent and capture $? explicitly because `if ! cmd`
  # would lose the original exit code (bash's `!` returns 0 or 1, not the
  # underlying command's rc).
  set +e
  spawn_agent "$WAKE_NUM"
  local_spawn_rc=$?
  set -e
  if [[ "$local_spawn_rc" -ne 0 ]]; then
    if [[ "$local_spawn_rc" -eq 2 ]]; then
      echo "[cb-review] spawn_agent returned 2 (harness misconfiguration); exiting" >&2
      exit 2
    fi
    echo "[cb-review] spawn_agent failed with rc=$local_spawn_rc (wake #$WAKE_NUM); retrying after 30s" >&2
    sleep 30
    continue
  fi

  # In single_agent mode, the wrapper is responsible for actually running
  # the loop; we just exit after handing off the brief.
  if [[ "$MODE" == "single_agent" ]]; then
    echo "[cb-review] single_agent handoff complete; wrapper owns the loop."
    exit 0
  fi

  # cli_layer mode: poll day-status.json until the agent exits or reaches
  # a terminal state. We don't read the agent's full transcript — only the
  # status file and whether the process is still alive.
  # Since spawn_agent above is synchronous (it blocks until the CLI exits),
  # we land here only after the agent process has ended. Check why.
  STATE="$(read_status_field state || true)"
  echo "[cb-review] wake #$WAKE_NUM exited; day-status.state='$STATE'"

  if is_terminal_state; then
    echo "[cb-review] terminal state reached: $STATE"
    if [[ "$STATE" == "fatal_blocked" ]]; then
      if [[ "$ALLOW_FATAL" -eq 1 ]]; then
        exit 0
      fi
      exit 1
    fi
    exit 0
  fi

  # Distinguish agent-signaled blocks from plain non-terminal exits. The
  # brief lets the agent set state=budget_exhausted or state=blocked itself
  # (both valid exit states per §10.5). budget_exhausted is a terminal-ish
  # outcome — exit 3 so the host scheduler knows the budget is gone. blocked
  # is transient — re-wake after the longer sleep.
  if is_blocked_state; then
    case "$STATE" in
      budget_exhausted)
        echo "[cb-review] agent signaled budget_exhausted; exiting 3" >&2
        exit 3
        ;;
      blocked)
        echo "[cb-review] agent signaled blocked; re-waking with resume brief in 60s" >&2
        sleep 60
        ;;
    esac
  else
    # Non-terminal, non-blocked exit: the agent either crashed, hit a
    # transient issue, or exhausted its own context. Re-wake with a resume hint.
    echo "[cb-review] non-terminal exit; re-waking with resume brief in 15s"
    sleep 15
  fi

  # Update the brief for the next wake to emphasize RESUME semantics.
  # NOTE: $RECORD is defined as a path variable near $STATUS_FILE (top of
  # §1). Under `set -u` the previous version's `$RECORD.md` / `$RECORD`
  # references were unbound and would crash the script on the first resume.
  read -r -d '' AGENT_BRIEF <<EOF || true
You are the cd-review agent for Exigo, RESUMING wake #$WAKE_NUM.
Read agents/cd-review/LOOP.md §8.2 (resume protocol) and §10.5 (exit conditions).
Read $RECORD (especially "Stopped at" and "Residual / backlog").
Read $STATUS_FILE.

RUN_ROOT=$RUN_ROOT
MODE=$MODE

CRITICAL RULES
- NO HUMAN IN THE LOOP. Continue, ship, or set state=fatal_blocked and exit.
- Do NOT re-run waves that already shipped. Pick up from last_step.
- Update $STATUS_FILE and $RECORD after every material step.

RESUME NEXT ACTION (from day-status.last_step): $(read_status_field last_step || echo unknown)
EOF
done
