# 029 — Context-Growth Budget Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--context-growth-budget-gate-red-team.md`

## Goal
Convert context-growth budget red-team risks into merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Near-threshold anti-evasion controls

### Scope
- Add moving-window utilization tracking (not point-in-time only).
- Introduce near-threshold warning debt accumulation.
- Emit deterministic escalation reasons for repeated near-threshold occupancy.

### Acceptance criteria
1. Oscillation fixtures cannot avoid warnings indefinitely.
2. Repeated near-threshold patterns trigger deterministic escalation reason codes.
3. No false escalations on stable low-utilization fixtures.

---

## Task 2 (P0): Mode-invariant enforcement + immutable threshold governance

### Scope
- Ensure hard-stop semantics are identical across raw-trace and narrated modes.
- Version-lock thresholds per evaluation window.
- Reject runs with unknown/mismatched threshold versions.

### Acceptance criteria
1. Raw/narrated fixtures produce identical hard-stop decisions.
2. Threshold-version mismatch yields deterministic rejection reason.
3. Threshold metadata is present in every budget verdict artifact.

---

## Task 3 (P1): Estimator-confidence and hard-stop abuse resistance

### Scope
- Attach confidence score to context-growth estimates.
- Use conservative accounting when confidence is low or traces are unparseable.
- Add repeated hard-stop abuse detection for policy scoring.

### Acceptance criteria
1. Low-confidence fixtures apply stricter accounting, not looser.
2. Unparseable trace fixtures cannot bypass hard threshold enforcement.
3. Repeated hard-stop abuse patterns are surfaced with deterministic flags.

---

## Next Task (single)
Implement Task 1 first in simulation-only helper (moving-window utilization + warning debt + deterministic escalation reasons), with no production runtime changes in the same PR.
