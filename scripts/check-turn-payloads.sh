#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=(
  "scripts/full-battle.ts"
  "scripts/spy-vs-spy-battle.ts"
  "scripts/ai-battle.ts"
)

violations=0
for f in "${TARGETS[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ missing target file: $f"
    violations=1
    continue
  fi

  if ! grep -q 'buildSignedTurnPayload' "$f"; then
    echo "❌ $f: missing buildSignedTurnPayload helper usage"
    violations=1
  fi

  if ! grep -q 'body: JSON.stringify(payload)' "$f"; then
    echo "❌ $f: turn POST must use JSON.stringify(payload)"
    violations=1
  fi
done

if [ "$violations" -ne 0 ]; then
  echo "\nTurn payload contract check FAILED"
  exit 1
fi

echo "✅ Turn payload contract check passed"
