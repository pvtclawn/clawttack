# 050 — Verification-Claim Multi-Perspective Triangulation Plan (2026-03-10)

## Context
Task-1 (semantic caveat quality) is complete at tooling scope. Remaining risk: a claim can be valid in one model/perspective but misleading system-wide.

Inspired by distributed-systems model plurality: different models capture different failure classes (e.g., message behavior ignored vs modeled).

## Objective
For claim classes beyond purely local fixture claims, require **multi-perspective evidence triangulation** before allowing `report-pass`:
- Perspective A: artifact-backed scoped proof,
- Perspective B: operational context signal (runtime/on-chain/route health, depending on claim class).

## Task (single, merge-sized next implementation target)
Add simulation/tooling helper in `packages/protocol`:
- Input:
  - claim class
  - evidence bundle with perspective tags
  - optional required perspective policy map per class
- Output deterministic verdict reasons:
  - `evidence-perspectives-aligned`
  - `evidence-perspective-insufficient`
  - `evidence-perspective-policy-mismatch`

## Acceptance criteria
1. Claim requiring two perspectives fails when only one perspective is present.
2. Claim fails when perspective tags conflict with class policy.
3. Identical input tuple returns deterministic verdict + artifact hash.
4. Fixture includes a "single-model true but system-incomplete" case and forces fail.

## Non-goals
- No production publish-path wiring in this slice.
- No social output automation.

## Next Task
Lane F: red-team triangulation gate for perspective-tag spoofing, stale operational signal abuse, and policy-downgrade bypass.
