# 033 — Conditional Commitment Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--conditional-commitment-schedule-red-team.md`

## Goal
Convert conditional-commitment schedule red-team risks into merge-sized implementation tasks with deterministic acceptance gates.

---

## Task 1 (P0): Anti-collusion + bonus eligibility integrity

### Scope
- Add pair-farming detection signals (repeated counterpart clustering + low adversarial-pressure profile).
- Cap commitment bonus contribution to rating/EV impact.
- Require adversarial-quality evidence before bonus vesting.

### Acceptance criteria
1. Collusive opt-in fixtures cannot produce net positive exploit EV.
2. Bonus vesting fails deterministically when adversarial-quality evidence is absent.
3. Pair-farming flags are emitted in deterministic artifact fields.

---

## Task 2 (P0): Noise-resilient abuse penalties + false-positive guard

### Scope
- Add confidence-weighted abuse-signal aggregation.
- Require corroboration/repetition before accelerated penalties apply.
- Emit penalty-trace artifacts for post-battle replay auditing.

### Acceptance criteria
1. Noisy-signal fixtures preserve positive EV for compliant strategies.
2. Repeated corroborated abuse fixtures still produce non-positive EV for abusive strategies.
3. Penalty acceleration path is replay-verifiable with reason + evidence references.

---

## Task 3 (P1): Late-defection clawback + mode-selection bias controls

### Scope
- Add delayed bonus vesting and clawback on late-stage defection.
- Add mode-conditioned telemetry for selective opt-in matchup bias.
- Include holdout policy-family robustness checks before promotion.

### Acceptance criteria
1. Late-defection fixtures lose EV after clawback/penalty adjustments.
2. Selective opt-in bias metrics remain within configured bounds.
3. Holdout policy-family runs retain claimed equilibrium advantage.

---

## Next Task (single)
Implement Task 1 first in simulation-only helper (pair-farming detection + bonus-cap + bonus-eligibility evidence gate), with no production behavior changes in the same PR.
