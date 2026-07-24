#!/usr/bin/env bash
# scripts/loop-forge-autonomous.sh
#
# Headless entry point for the loop-forge loop. Designed to run in a
# sealed environment with no human in the loop. See
# agents/loop-forge/LOOP.md §0.5 for the full protocol.
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
#      budget is exhausted. Also handle the self_extending state by reading
#      the nested run's day-status.json (see LOOP.md §7.6.2).
#   6. Exit non-zero on fatal blocks so the host scheduler (cron / systemd
#      / CI) can alert or restart cleanly.
#
# This script does NOT implement the wave logic itself — that lives in
# LOOP.md so the agent can adapt it without a script redeploy.
#
# Usage:
#   loop-forge-autonomous.sh                              # today, fresh or resume
#   loop-forge-autonomous.sh --date 2026-07-25            # specific date
#   loop-forge-autonomous.sh --resume                     # latest dated run
#   loop-forge-autonomous.sh --scope "loop-forge:research-survey"
#   loop-forge-autonomous.sh --max-runtime 43200          # 12h wall-clock cap (seconds)
#   loop-forge-autonomous.sh --max-wakeups 8              # cap on re-spawn attempts
#   loop-forge-autonomous.sh --trigger-brief "build a loop that surveys research papers on X weekly"
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
# own status, so a host scheduler cannot distinguish "script bug" from
# "fatal blocked" (1) or "budget exhausted" (3).
trap 'echo "[loop-forge] FATAL: unhandled error on line $LINENO (exit $?)" >&2; exit 4' ERR

# ---------------------------------------------------------------------------
# 0. Defaults & arg parsing
# ---------------------------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DATE_ARG=""
SCOPE_HINT=""
TRIGGER_BRIEF=""
MAX_RUNTIME=43200      # 12 hours; matches a single day-scope context budget
MAX_WAKEUPS=8
ALLOW_FATAL=0
AGENT_BIN_OVERRIDE=""
EXTRA_AGENT_FLAGS=()

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
  exit 2
}

require_arg() {
  local flag="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "error: $flag requires a value" >&2
    usage
  fi
}

require_int() {
  local flag="$1" value="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "error: $flag requires a non-negative integer, got: $value" >&2
    usage
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date)          require_arg "$1" "${2:-}"; DATE_ARG="$2"; shift 2 ;;
    --resume)        DATE_ARG="__resume__"; shift ;;
    --scope)         require_arg "$1" "${2:-}"; SCOPE_HINT="$2"; shift 2 ;;
    --trigger-brief) require_arg "$1" "${2:-}"; TRIGGER_BRIEF="$2"; shift 2 ;;
    --max-runtime)   require_arg "$1" "${2:-}"; require_int "$1" "$2"; MAX_RUNTIME="$2"; shift 2 ;;
    --max-wakeups)   require_arg "$1" "${2:-}"; require_int "$1" "$2"; MAX_WAKEUPS="$2"; shift 2 ;;
    --allow-fatal)   ALLOW_FATAL=1; shift ;;
    --agent-bin)     require_arg "$1" "${2:-}"; AGENT_BIN_OVERRIDE="$2"; shift 2 ;;
    --agent-flag)    require_arg "$1" "${2:-}"; EXTRA_AGENT_FLAGS+=("$2"); shift 2 ;;
    -h|--help)       usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Resolve RUN_ROOT
# ---------------------------------------------------------------------------

LOOP_FORGE_DIR="$REPO_ROOT/agents/loop-forge"

if [[ "$DATE_ARG" == "" ]]; then
  RUN_DATE="$(date -u +%Y-%m-%d)"
elif [[ "$DATE_ARG" == "__resume__" ]]; then
  # Pick the most recent dated dir whose day-status.json is NOT in a
  # terminal state. Skip complete/fatal_blocked dirs so we never re-enter
  # a finished day and risk mutating its artifacts. If every prior run is
  # terminal, fall through to today.
  RUN_DATE=""
  while IFS= read -r -d '' dir; do
    dir_date="$(basename "$dir")"
    status_file="$dir/audits/day-status.json"
    if [[ ! -f "$status_file" ]]; then
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
        continue
        ;;
      *)
        RUN_DATE="$dir_date"
        break
        ;;
    esac
  done < <(find "$LOOP_FORGE_DIR" -maxdepth 1 -mindepth 1 \
            -type d -name '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' \
            -printf '%p\0' 2>/dev/null | sort -rz)

  if [[ -z "$RUN_DATE" ]]; then
    echo "[loop-forge] no prior non-terminal dated run found; starting fresh for today" >&2
    RUN_DATE="$(date -u +%Y-%m-%d)"
  else
    echo "[loop-forge] --resume picked run: $RUN_DATE"
  fi
else
  RUN_DATE="$DATE_ARG"
fi

RUN_ROOT="$LOOP_FORGE_DIR/$RUN_DATE"
mkdir -p "$RUN_ROOT/audits/discover" "$RUN_ROOT/audits/designs" \
         "$RUN_ROOT/audits/drafts" "$RUN_ROOT/audits/pre-pr" \
         "$RUN_ROOT/audits/self-extend"

STATUS_FILE="$RUN_ROOT/audits/day-status.json"
RECORD="$RUN_ROOT/RECORD.md"

echo "[loop-forge] RUN_ROOT=$RUN_ROOT"
echo "[loop-forge] STATUS_FILE=$STATUS_FILE"

# Persist the trigger brief verbatim before doing anything else, so a
# crash does not lose the original ask. LOOP.md §1.3 requires this.
if [[ -n "$TRIGGER_BRIEF" ]]; then
  echo "[loop-forge] writing trigger brief to $RUN_ROOT/audits/discover/brief.md"
  # Use printf to avoid echo interpreting backslash escapes in the brief.
  printf '%s\n' "$TRIGGER_BRIEF" > "$RUN_ROOT/audits/discover/brief.md"
fi

# ---------------------------------------------------------------------------
# 2. Harness capability detection
# ---------------------------------------------------------------------------
#
# Same two modes as cb-review-autonomous.sh:
#
#   cli_layer:      a launcher process spawns a separate day-scope agent
#                   process (peer, not subagent). The launcher polls
#                   day-status.json and re-wakes the peer on crash/stall.
#
#   single_agent:   one agent process owns everything. It runs the loop
#                   end-to-end using only its in-process subagent primitive
#                   for waves. No peer process.

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

echo "[loop-forge] AGENT_CLI=$AGENT_CLI  MODE=$MODE"

if [[ "$MODE" == "cli_layer" ]] && ! command -v "$AGENT_CLI" >/dev/null 2>&1; then
  echo "FATAL: cli_layer mode selected but '$AGENT_CLI' is not on PATH" >&2
  exit 2
fi

# Write a mode marker that LOOP.md §0.5 tells the agent to read.
# Emit via python3 so all string fields are JSON-escaped.
if command -v python3 >/dev/null 2>&1; then
  python3 -c "
import json
d = {
    'mode': '$MODE',
    'agent_cli': '$AGENT_CLI',
    'max_runtime_seconds': $MAX_RUNTIME,
    'max_wakeups': $MAX_WAKEUPS,
    'scope_hint': $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$SCOPE_HINT"),
    'trigger_brief': $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$TRIGGER_BRIEF"),
    'detected_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
}
with open('$RUN_ROOT/audits/harness-mode.json', 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\\n')
"
else
  esc_scope="${SCOPE_HINT//\\/\\\\}"
  esc_scope="${esc_scope//\"/\\\"}"
  esc_brief="${TRIGGER_BRIEF//\\/\\\\}"
  esc_brief="${esc_brief//\"/\\\"}"
  cat > "$RUN_ROOT/audits/harness-mode.json" <<EOF
{
  "mode": "$MODE",
  "agent_cli": "$AGENT_CLI",
  "max_runtime_seconds": $MAX_RUNTIME,
  "max_wakeups": $MAX_WAKEUPS,
  "scope_hint": "$esc_scope",
  "trigger_brief": "$esc_brief",
  "detected_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
fi

# ---------------------------------------------------------------------------
# 3. Build the agent brief
# ---------------------------------------------------------------------------

SCOPE_LINE=""
[[ -n "$SCOPE_HINT" ]] && SCOPE_LINE="SCOPE_HINT: $SCOPE_HINT"

BRIEF_LINE=""
[[ -n "$TRIGGER_BRIEF" ]] && BRIEF_LINE="TRIGGER_BRIEF: $TRIGGER_BRIEF"

read -r -d '' AGENT_BRIEF <<EOF || true
You are the loop-forge agent.
Read and obey agents/loop-forge/LOOP.md IN FULL before doing anything else.
Then read agents/loop-forge/REVIEW-LENS.md (Wave D reviewer catalogue).
Then read agents/cd-review/LOOP.md (a working reference loop in a different
domain — your produced loop should be structurally similar but
domain-appropriate).

RUN_ROOT=$RUN_ROOT
RUN_DATE=$RUN_DATE
MODE=$MODE
$SCOPE_LINE
$BRIEF_LINE

CRITICAL RULES
- NO HUMAN IN THE LOOP. Do not pause to ask "should I continue?". Do not
  print "waiting for user" and stop. Either continue, ship, or set
  day-status.json state=fatal_blocked with a precise blocked_reason and
  exit non-zero.
- Artifacts are truth. Keep RECORD.md and audits/day-status.json current
  after every material step (wave start/end, ship step, PR open/merge,
  Wave E spawn, block). A cold resume must be possible from these two
  files alone.
- The product of this loop is OTHER LOOPS. Every produced loop must
  inherit the operating contract: §0.5 harness with single-agent fallback,
  §0.5.3 no-human rule, §0.5.4 day-status.json, §8.3 continuity invariants,
  §10.5 exit conditions, §11 combineability contract, §12 autonomy
  checklist. Wave D enforces all of these.
- Obey §10.2 ship protocol: land develop → PR main → external-reviewer
  iterate (if any) → merge main.
- Obey §10.5 exit conditions: complete | fatal_blocked | budget_exhausted
  | blocked | self_extending.
- Update day-status.json to one of: running | shipping | waiting_external
  | blocked | fatal_blocked | complete | budget_exhausted | self_extending.
  Never leave it on "running" when you exit.

START
1. If $STATUS_FILE does not exist or state is complete/fatal_blocked and
   this is a fresh run: scaffold per LOOP.md §1 (RECORD.md, brief.md,
   day-status.json init).
2. If $STATUS_FILE exists with state in {running, shipping,
   waiting_external, blocked, budget_exhausted, self_extending}: this is
   a RESUME. Read RECORD.md "Stopped at" + day-status.json last_step and
   continue from there. Do NOT re-run waves that already shipped.
3. If state is self_extending: read day-status.json.wave_e_run_root, read
   that nested run's day-status.json, and resume only if the nested run
   is terminal (complete | fatal_blocked). Otherwise exit and let the
   launcher re-wake later.
4. Run the loop autonomously until a terminal state per §10.5.
EOF

# ---------------------------------------------------------------------------
# 4. Spawn function (mode-specific)
# ---------------------------------------------------------------------------

spawn_agent() {
  # Returns:
  #   0  agent invocation succeeded (agent may still have exited non-zero)
  #   2  harness misconfiguration (unknown CLI, binary not on PATH, or no
  #      spawn case matched) — these are hard fails; do NOT silently retry
  local wake_num="$1"
  local log_file="$RUN_ROOT/audits/agent-wake-${wake_num}.log"
  echo "[loop-forge] spawning wake #$wake_num → $log_file"

  if [[ "$AGENT_CLI" != "self" ]] && ! command -v "$AGENT_CLI" >/dev/null 2>&1; then
    echo "FATAL: AGENT_CLI='$AGENT_CLI' is not on PATH" >&2
    return 2
  fi

  local rc=0
  case "$AGENT_CLI" in
    self)
      # Single-agent mode: drop a marker file the host agent's wrapper is
      # expected to pick up, then exit so the wrapper can hand the brief
      # to its own subagent spawn.
      echo "$AGENT_BRIEF" > "$RUN_ROOT/audits/pending-brief.txt"
      echo "[loop-forge] MODE=single_agent: brief written to \
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
      echo "$AGENT_BRIEF" | "$AGENT_CLI" --cwd "$REPO_ROOT" \
        "${EXTRA_AGENT_FLAGS[@]}" >"$log_file" 2>&1 || rc=$?
      ;;
    *)
      echo "FATAL: no spawn case for AGENT_CLI=$AGENT_CLI" >&2
      return 2
      ;;
  esac

  if [[ "$rc" -ne 0 ]]; then
    echo "[loop-forge] wake #$wake_num: agent exited non-zero (rc=$rc) — will classify via day-status.json" >&2
  fi
  return 0
}

# ---------------------------------------------------------------------------
# 5. Status helpers
# ---------------------------------------------------------------------------

read_status_field() {
  [[ -f "$STATUS_FILE" ]] || return 0
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

# Read a field from an arbitrary day-status.json path (used for Wave E
# nested-run polling).
read_status_field_from() {
  local file="$1" field="$2"
  [[ -f "$file" ]] || return 0
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json, sys
try:
    d = json.load(open('$file'))
except Exception:
    sys.exit(0)
v = d.get('$field')
if v is not None:
    print(v)
" 2>/dev/null
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

is_self_extending() {
  local s
  s="$(read_status_field state || true)"
  [[ "$s" == "self_extending" ]]
}

# ---------------------------------------------------------------------------
# 6. Supervise: spawn / re-wake loop
# ---------------------------------------------------------------------------

START_EPOCH="$(date +%s)"
WAKE_NUM=0

while true; do
  WAKE_NUM=$((WAKE_NUM + 1))

  if [[ "$WAKE_NUM" -gt "$MAX_WAKEUPS" ]]; then
    echo "[loop-forge] wakeup budget exhausted ($MAX_WAKEUPS); exiting 3" >&2
    exit 3
  fi

  NOW_EPOCH="$(date +%s)"
  ELAPSED=$((NOW_EPOCH - START_EPOCH))
  if [[ "$ELAPSED" -ge "$MAX_RUNTIME" ]]; then
    echo "[loop-forge] wall-clock budget exhausted (${ELAPSED}s ≥ ${MAX_RUNTIME}s); exiting 3" >&2
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

  # Handle self_extending: do NOT spawn the parent; instead, poll the
  # nested run's day-status.json and re-wake the parent only when the
  # nested run is terminal. LOOP.md §7.6.2.
  if is_self_extending; then
    nested_root="$(read_status_field wave_e_run_root || true)"
    if [[ -z "$nested_root" ]]; then
      echo "[loop-forge] FATAL: state=self_extending but wave_e_run_root is empty" >&2
      exit 4
    fi
    nested_status="$REPO_ROOT/$nested_root/audits/day-status.json"
    nested_state="$(read_status_field_from "$nested_status" state || true)"
    echo "[loop-forge] parent is self_extending; nested run state='$nested_state'"
    case "$nested_state" in
      complete|fatal_blocked)
        # Nested run is terminal — re-wake the parent so it can resume
        # post-E flow (update §11, re-run Wave D on touched files, ship).
        echo "[loop-forge] nested run terminal; re-waking parent"
        ;;
      *)
        # Nested run still in progress — sleep and re-check on next wake.
        echo "[loop-forge] nested run still in progress; sleeping 300s and re-checking"
        sleep 300
        continue
        ;;
    esac
  fi

  set +e
  spawn_agent "$WAKE_NUM"
  local_spawn_rc=$?
  set -e
  if [[ "$local_spawn_rc" -ne 0 ]]; then
    if [[ "$local_spawn_rc" -eq 2 ]]; then
      echo "[loop-forge] spawn_agent returned 2 (harness misconfiguration); exiting" >&2
      exit 2
    fi
    echo "[loop-forge] spawn_agent failed with rc=$local_spawn_rc (wake #$WAKE_NUM); retrying after 30s" >&2
    sleep 30
    continue
  fi

  if [[ "$MODE" == "single_agent" ]]; then
    echo "[loop-forge] single_agent handoff complete; wrapper owns the loop."
    exit 0
  fi

  STATE="$(read_status_field state || true)"
  echo "[loop-forge] wake #$WAKE_NUM exited; day-status.state='$STATE'"

  if is_terminal_state; then
    echo "[loop-forge] terminal state reached: $STATE"
    if [[ "$STATE" == "fatal_blocked" ]]; then
      if [[ "$ALLOW_FATAL" -eq 1 ]]; then
        exit 0
      fi
      exit 1
    fi
    exit 0
  fi

  if is_blocked_state; then
    case "$STATE" in
      budget_exhausted)
        echo "[loop-forge] agent signaled budget_exhausted; exiting 3" >&2
        exit 3
        ;;
      blocked)
        echo "[loop-forge] agent signaled blocked; re-waking with resume brief in 60s" >&2
        sleep 60
        ;;
    esac
  else
    echo "[loop-forge] non-terminal exit; re-waking with resume brief in 15s"
    sleep 15
  fi

  read -r -d '' AGENT_BRIEF <<EOF || true
You are the loop-forge agent, RESUMING wake #$WAKE_NUM.
Read agents/loop-forge/LOOP.md §8.2 (resume protocol) and §10.5 (exit
conditions).
Read $RECORD (especially "Stopped at" and "Residual / backlog").
Read $STATUS_FILE.

RUN_ROOT=$RUN_ROOT
MODE=$MODE

CRITICAL RULES
- NO HUMAN IN THE LOOP. Continue, ship, or set state=fatal_blocked and exit.
- Do NOT re-run waves that already shipped. Pick up from last_step.
- If state is self_extending: read wave_e_run_root/day-status.json and
  resume only if the nested run is terminal; otherwise exit and let the
  launcher re-wake later.
- Update $STATUS_FILE and $RECORD after every material step.

RESUME NEXT ACTION (from day-status.last_step): $(read_status_field last_step || echo unknown)
EOF
done
