# 048 — Verification Claim Completeness Gate Plan (2026-03-10)

## Problem
Current heartbeat/reliability updates are strong on evidence links, but can still drift into **incomplete truth**: claims are correct yet omit required caveats about scope, open regressions, or integration status.

## Objective
Introduce a deterministic pre-publish gate for internal/external status claims so that every claim is both:
1. **Correct** (evidence-backed, non-overclaiming), and
2. **Complete** (includes required caveats and scope bounds).

## Task (single, merge-sized)
Implement simulation-only helper in `packages/protocol`:
- Input:
  - claim class (`simulation-verified`, `integration-verified`, `runtime-verified`)
  - evidence set (artifacts/commits/checks)
  - known-open-risk flags (e.g., unresolved regression, missing integration coverage)
- Output deterministic verdict + reason:
  - `report-pass`
  - `report-incomplete-missing-caveat`
  - `report-overclaim-risk`

## Acceptance criteria
1. Deterministic verdict for identical input tuples.
2. If claim class exceeds evidence scope, helper returns `report-overclaim-risk`.
3. If open-risk flag is present without required caveat text marker, helper returns `report-incomplete-missing-caveat`.
4. Fixture set includes at least one "correct but incomplete" case and forces fail.

## Non-goals
- No production publish automation in this slice.
- No social auto-posting logic changes.

## Next Task
Lane F: red-team this completeness gate for caveat token gaming, evidence laundering, and wording-level bypasses.
