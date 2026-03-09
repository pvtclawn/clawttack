# 015 — StallGuard Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--stallguard-conditional-commitment-red-team.md`

## Goal
Convert StallGuard red-team risks into minimal, merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Delay semantics + escalation determinism

### Scope
- Define severe-delay criteria using chain-observable timing only.
- Add deterministic escalation ordering for multi-event edge cases.
- Emit replay-verifiable reason codes for each escalation decision.

### Acceptance criteria
1. Property tests prove escalation is actor-specific and monotonic.
2. Tie/near-simultaneous delay events resolve to a single deterministic order.
3. Every escalation decision includes reason code sufficient for replay validation.

---

## Task 2 (P0): Mode safety + baseline-equivalence harness

### Scope
- Enforce bilateral StallGuard opt-in requirement.
- Add baseline-equivalence tests to guarantee mode-off behavior matches current rules.
- Prevent accidental activation in non-StallGuard battles.

### Acceptance criteria
1. Battles missing bilateral opt-in cannot activate StallGuard paths.
2. Mode-off state transition traces are equivalent to current baseline fixtures.
3. Canary flag can disable StallGuard globally without altering baseline outcomes.

---

## Task 3 (P1): Economic calibration + anti-selection telemetry

### Scope
- Define stake-band-aware penalty envelope (cap/floor).
- Add telemetry fields for mode-conditioned outcomes (stall rate, false positives, EV deltas).
- Prepare simulation matrix across stake tiers and latency profiles.

### Acceptance criteria
1. Sim artifacts report false-positive rate by stake band + latency profile.
2. Penalty function remains bounded and does not create dominated low-stake abuse path.
3. Mode-conditioned outcome metrics are available for ranking policy decisions.

---

## Next Task (single)
Implement Task 2 first: add bilateral opt-in + mode-off baseline-equivalence tests behind feature flag, with no payout logic changes in the same PR.
