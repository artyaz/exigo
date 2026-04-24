#!/usr/bin/env zsh
set -euo pipefail

#─────────────────────────────────────────────
# Exigo Maintenance Agent Runner
# Runs Claude Code against a random slice of
# the codebase, commits fixes, opens a PR,
# then checks back for review comments.
#─────────────────────────────────────────────

REPO="${EXIGO_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
INSTRUCTIONS="$REPO/.maintenance/AGENT_INSTRUCTIONS.md"
LOG_DIR="$REPO/.maintenance/logs"
BRANCH_PREFIX="maint"
BASE_BRANCH="develop"
REVIEW_DELAY_SECONDS=1200  # 20 minutes

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/$TIMESTAMP.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE" }

#─────────────────────────────────────────────
# 1. Pick a random target
#─────────────────────────────────────────────

CATEGORIES=(
  "convex:convex/*.ts"
  "api-routes:src/app/api/**/*.ts"
  "learn-components:src/app/_components/learn/*.tsx"
  "test-components:src/app/_components/tests/*.tsx"
  "space-components:src/app/_components/spaces/*.tsx"
  "shared-components:src/app/_components/shared/*.tsx"
  "pages:src/app/spaces/**/*.tsx"
  "actions:src/app/actions/*.ts"
  "shared-utils:shared/*.ts"
  "hooks:src/app/_hooks/*.ts"
)

if [[ -n "${1:-}" ]]; then
  CATEGORY="$1"
  PATTERN=""
  for entry in "${CATEGORIES[@]}"; do
    if [[ "$entry" == "$1:"* ]]; then
      PATTERN="${entry#*:}"
      break
    fi
  done
  if [[ -z "$PATTERN" ]]; then
    PATTERN="$1"
    CATEGORY="custom"
  fi
else
  RANDOM_INDEX=$(( RANDOM % ${#CATEGORIES[@]} + 1 ))
  RANDOM_ENTRY="${CATEGORIES[$RANDOM_INDEX]}"
  CATEGORY="${RANDOM_ENTRY%%:*}"
  PATTERN="${RANDOM_ENTRY#*:}"
fi

log "Category: $CATEGORY"
log "Pattern: $PATTERN"

cd "$REPO"

# Collect matching files (zsh glob, BSD-compatible)
ALL_FILES=()
for f in ${~PATTERN}(N); do
  [[ "$f" == *node_modules* || "$f" == *_generated* ]] && continue
  ALL_FILES+=("$f")
done

if [[ ${#ALL_FILES[@]} -eq 0 ]]; then
  log "No files found for pattern: $PATTERN"
  exit 0
fi

# Pick 3-5 random files
NUM_FILES=$(( RANDOM % 3 + 3 ))
if [[ ${#ALL_FILES[@]} -lt $NUM_FILES ]]; then
  NUM_FILES=${#ALL_FILES[@]}
fi

# Shuffle using awk (BSD-compatible, no sort -R)
TARGET_FILES=("${(@f)$(printf '%s\n' "${ALL_FILES[@]}" | awk 'BEGIN{srand()}{print rand()"\t"$0}' | sort -n | cut -f2- | head -$NUM_FILES)}")

log "Target files ($NUM_FILES):"
for f in "${TARGET_FILES[@]}"; do log "  $f"; done

#─────────────────────────────────────────────
# 2. Prepare branch
#─────────────────────────────────────────────

BRANCH_NAME="$BRANCH_PREFIX/$CATEGORY-$(date +%m%d-%H%M)"

git fetch origin "$BASE_BRANCH" --quiet
git checkout -B "$BRANCH_NAME" "origin/$BASE_BRANCH" --quiet

log "Branch: $BRANCH_NAME (from origin/$BASE_BRANCH)"

#─────────────────────────────────────────────
# 3. Run Claude Code
#─────────────────────────────────────────────

PROMPT="$(cat "$INSTRUCTIONS")

---

## This Run's Target

**Category**: $CATEGORY
**Files to review and improve**:
$(printf '- %s\n' "${TARGET_FILES[@]}")

Review each file. Fix bugs, improve code quality, optimize performance, and enhance UX to feel more native and alive. Add tests only where genuinely valuable (see Testing Philosophy in instructions).

After making changes:
1. Run \`npx tsc --noEmit\` to verify types
2. If tests exist, run them to verify nothing broke
3. Commit each logical change separately with human-like messages
4. Do NOT create a PR — the runner script handles that"

log "Starting Claude Code..."

SKIP_PERMS_FLAG=()
if [[ "${CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS:-0}" == "1" ]]; then
  SKIP_PERMS_FLAG=(--dangerously-skip-permissions)
fi

claude -p "$PROMPT" \
  "${SKIP_PERMS_FLAG[@]}" \
  --verbose \
  >> "$LOG_FILE" 2>&1 || {
    log "Claude Code exited with error (may still have made changes)"
  }

log "Claude Code finished"

#─────────────────────────────────────────────
# 4. Check if there are changes to push
#─────────────────────────────────────────────

COMMIT_COUNT=$(git rev-list --count "origin/$BASE_BRANCH"..HEAD 2>/dev/null)

if [[ "$COMMIT_COUNT" -eq 0 ]] && [[ -z "$(git status --porcelain)" ]]; then
  log "No changes made. Cleaning up branch."
  git checkout "$BASE_BRANCH" --quiet 2>/dev/null || true
  git branch -D "$BRANCH_NAME" --quiet 2>/dev/null || true
  exit 0
fi

# Commit any unstaged leftovers
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "cleanup remaining changes from maintenance sweep" --quiet
  COMMIT_COUNT=$(git rev-list --count "origin/$BASE_BRANCH"..HEAD)
fi

log "Pushing $COMMIT_COUNT commit(s)..."
git push origin "$BRANCH_NAME" -u --quiet 2>&1 | tee -a "$LOG_FILE"

#─────────────────────────────────────────────
# 5. Create PR
#─────────────────────────────────────────────

COMMIT_LOG=$(git log --oneline "origin/$BASE_BRANCH"..HEAD)

PR_TITLE="maintenance: $CATEGORY sweep $(date +%m/%d)"

PR_BODY="## Maintenance Sweep — \`$CATEGORY\`

**Files reviewed:**
$(printf '- \`%s\`\n' "${TARGET_FILES[@]}")

**Changes ($COMMIT_COUNT commits):**
$(echo "$COMMIT_LOG" | sed 's/^[a-f0-9]* /- /')

---
Automated maintenance by Claude Code agent."

PR_URL=$(gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH_NAME" \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  2>&1) || {
    log "Failed to create PR: $PR_URL"
    exit 1
  }

log "PR created: $PR_URL"

#─────────────────────────────────────────────
# 6. Wait and check for review comments
#─────────────────────────────────────────────

PR_NUMBER=$(echo "$PR_URL" | grep -o '[0-9]*$')

log "Waiting ${REVIEW_DELAY_SECONDS}s before checking for comments..."
sleep "$REVIEW_DELAY_SECONDS"

log "Checking PR #$PR_NUMBER for review comments..."

COMMENTS=$(gh pr view "$PR_NUMBER" --json reviews,comments --jq '
  [.reviews[].body // empty, .comments[].body // empty] | join("\n---\n")
' 2>/dev/null || echo "")

REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || git remote get-url origin | sed 's|.*github\.com[:/]\(.*\)\.git$|\1|;t;s|.*github\.com[:/]\(.*\)$|\1|')

REVIEW_COMMENTS=$(gh api "repos/$REPO_SLUG/pulls/$PR_NUMBER/comments" --jq '
  [.[] | "\(.path):\(.line // .original_line): \(.body)"] | join("\n---\n")
' 2>/dev/null || echo "")

ALL_FEEDBACK="${COMMENTS}
${REVIEW_COMMENTS}"

ALL_FEEDBACK=$(echo "$ALL_FEEDBACK" | sed '/^[[:space:]]*$/d')

if [[ -z "$ALL_FEEDBACK" ]]; then
  log "No review comments found. Done."
  exit 0
fi

log "Found review comments. Running Claude to address them..."

REVIEW_FIX_BASE_HEAD=$(git rev-parse HEAD)

FIX_PROMPT="You are working on PR #$PR_NUMBER on branch $BRANCH_NAME.

The PR was a maintenance sweep of the \`$CATEGORY\` category. Here are the review comments that need to be addressed:

$ALL_FEEDBACK

Read the relevant files, understand the feedback, make the fixes, and commit with a clear message describing what you fixed. Run \`npx tsc --noEmit\` after changes."

claude -p "$FIX_PROMPT" \
  "${SKIP_PERMS_FLAG[@]}" \
  --verbose \
  >> "$LOG_FILE" 2>&1 || {
    log "Claude Code (review fix) exited with error"
  }

# Push fixes
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "address review feedback on maintenance PR" --quiet
fi

REVIEW_FIX_HEAD=$(git rev-parse HEAD)
if [[ "$REVIEW_FIX_HEAD" != "$REVIEW_FIX_BASE_HEAD" ]]; then
  REVIEW_FIX_COMMITS=$(git rev-list --count "$REVIEW_FIX_BASE_HEAD"..HEAD 2>/dev/null || echo 0)
  git push origin "$BRANCH_NAME" --quiet 2>&1 | tee -a "$LOG_FILE"
  log "Pushed $REVIEW_FIX_COMMITS fix commit(s)"
  gh pr comment "$PR_NUMBER" --body "Addressed review comments in $REVIEW_FIX_COMMITS commit(s)." 2>/dev/null
fi

log "Done. PR: $PR_URL"
