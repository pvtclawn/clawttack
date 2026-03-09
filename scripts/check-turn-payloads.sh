#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=(
  "scripts/full-battle.ts"
  "scripts/spy-vs-spy-battle.ts"
  "scripts/ai-battle.ts"
)

RUN_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
EXPECTED="${#TARGETS[@]}"
COVERED=0
violations=0

for f in "${TARGETS[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ missing target file: $f"
    violations=1
    continue
  fi

  COVERED=$((COVERED + 1))

  if ! grep -q 'buildSignedTurnPayload' "$f"; then
    echo "❌ $f: missing buildSignedTurnPayload helper usage"
    violations=1
  fi

  if ! grep -q 'body: JSON.stringify(payload)' "$f"; then
    echo "❌ $f: turn POST must use JSON.stringify(payload)"
    violations=1
  fi
done

echo "--- turn payload contract coverage ---"
echo "timestamp: $RUN_TS"
echo "git_sha: $GIT_SHA"
echo "enforced_files:"
for f in "${TARGETS[@]}"; do
  echo "  - $f"
done
echo "coverage: ${COVERED}/${EXPECTED}"

if [ "$violations" -ne 0 ]; then
  echo "result: FAIL"
  echo "\nTurn payload contract check FAILED"
  exit 1
fi

echo "result: PASS"
echo "✅ Turn payload contract check passed"
