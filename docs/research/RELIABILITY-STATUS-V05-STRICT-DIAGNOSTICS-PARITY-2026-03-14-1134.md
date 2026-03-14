# Reliability Status — v05 strict-diagnostics parity (2026-03-14 11:34 UTC)

## Scope
Synthesize current reliability status after strict-diagnostics parity verification and decide the highest-value next slice.

## Current reliability status (narrow, evidence-backed)
1. Strict diagnostics are now JSON-first and parity-stable with Markdown mirrors:
   - `strictMode`
   - `strictViolationCount`
   - `strictViolations`
2. Output-boundary semantics are in place: summaries are written before strict-mode exit.
3. Current labeled run remains clean:
   - `labelHygieneOk=true`
   - `maxTurnsComparable=true`
   - `warnings=[]`
   - `strictViolationCount=0`

## What this does NOT prove yet
- It does not yet prove strict-mode behavior under intentionally contaminated inputs.
- It does not yet prove orthogonal contamination counters are complete enough to prevent all false-greens.

## Highest-value next slice
Run strict-violation injection coverage so strict mode is validated against known-bad inputs, not only clean runs.

### Proposed minimal coverage targets
1. blank/normalized-equal labels,
2. mixed observed `maxTurnsConfigured` values,
3. stale/contaminated aggregate source simulation.

Expected result: diagnostics still persist, strict mode exits non-zero, and violation fields are deterministic.

## On-chain classification
Verified no on-chain action needed (local reliability/instrumentation synthesis only).