# 153 — V05 Task 3 Comparable-Gate Implementation Next Slices (2026-03-14)

## Context
Task 3 needs a **comparison-level `comparable` gate** that fails closed when evidence quality is insufficient. This plan converts the red-team critique from `REDTEAM-V05-TASK3-COMPARABLE-GATE-2026-03-14-1355.md` into a tight implementation sequence.

## Task 1 (P0): JSON-first comparable contract with deterministic reasons
Implement comparison output fields:
- `comparable: boolean`
- `comparabilityReasons: string[]` (deterministically ordered)

Reason classes (ordered):
1. `missing-baseline`
2. `strict-violation`
3. `guardrail-failure`
4. `runconfig-drift-outside-allowed-variable`

### Acceptance criteria
- Comparison JSON always includes `comparable` and `comparabilityReasons`.
- Ordering of `comparabilityReasons` is deterministic across reruns.
- Gate is conjunctive fail-closed (`comparable=true` only when all required conditions pass).

## Task 2 (P0): Allowed-drift enforcement for single-variable intervention
Implement run-config drift checks so comparison only remains comparable when differences are restricted to declared intervention variable (`maxTurnsConfigured`) and expected label metadata.

### Acceptance criteria
- Drift outside allowed fields forces `comparable=false` with reason `runconfig-drift-outside-allowed-variable`.
- Clean strict + matching guardrails + allowed drift path yields `comparable=true`.
- Missing previous fingerprint/baseline yields `comparable=false` with `missing-baseline`.

## Task 3 (P1): Non-evaluative markdown when non-comparable
When `comparable=false`, markdown must avoid evaluative language and explicitly list reasons.

### Acceptance criteria
- Aggregate comparison markdown mirrors `comparable` and ordered `comparabilityReasons`.
- If non-comparable, markdown includes explicit “non-comparable” notice and blocks comparative verdict text.

## Priority order
1. Task 1 (contract + deterministic reasons)
2. Task 2 (drift enforcement)
3. Task 3 (markdown policy hardening)

## Narrow caveat
This plan hardens interpretation integrity only. It does not itself improve gameplay quality, settlement reliability, or battle-volume confidence.
