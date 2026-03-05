#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEMORY_DIR="$(cd "$ROOT/../../memory" && pwd)"
METRICS_DIR="$MEMORY_DIR/metrics"

DATE_TAG="$(date +%F)"
BASELINE_PATH="$METRICS_DIR/resulttype-baseline-$DATE_TAG.json"
SNAPSHOT_PATH="/tmp/resulttype-baseline-pre-submit-$DATE_TAG.json"

echo "[1/4] Generate fresh baseline artifact"
bun run "$ROOT/scripts/resulttype-baseline.ts" >/tmp/pre-submit-baseline.log

if [[ ! -f "$BASELINE_PATH" ]]; then
  echo "ERROR: baseline artifact missing at $BASELINE_PATH"
  exit 10
fi

cp "$BASELINE_PATH" "$SNAPSHOT_PATH"

echo "[2/4] Re-generate baseline for candidate window"
bun run "$ROOT/scripts/resulttype-baseline.ts" >/tmp/pre-submit-candidate.log

echo "[3/4] Run comparator (baseline vs candidate)"
COMPARE_OUTPUT="$(bun run "$ROOT/scripts/compare-resulttype-artifacts.ts" "$SNAPSHOT_PATH" "$BASELINE_PATH" || true)"
echo "$COMPARE_OUTPUT"

STATUS="$(echo "$COMPARE_OUTPUT" | bun -e 'const fs=require("fs");const t=fs.readFileSync(0,"utf8");try{const j=JSON.parse(t);process.stdout.write(j.status||"unknown")}catch{process.stdout.write("parse_error")}')"

if [[ "$STATUS" == "non_comparable" || "$STATUS" == "parse_error" || "$STATUS" == "unknown" ]]; then
  echo "[4/4] FAIL: pre-submit verification did not produce comparable output"
  exit 20
fi

echo "[4/4] PASS: pre-submit verification comparable"
echo "Artifact: $BASELINE_PATH"
