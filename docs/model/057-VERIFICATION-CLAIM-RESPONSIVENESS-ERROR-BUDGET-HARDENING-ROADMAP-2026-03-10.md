# 057 — Verification-Claim Responsiveness Error-Budget Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-RESPONSIVENESS-ERROR-BUDGET-REDTEAM-2026-03-10.md`

Goal: prevent responsiveness/error-budget controls from being satisfied through window/latency/accounting manipulation while true verification quality degrades.

## Task 1 — Dual-Horizon Budget Accounting + Sticky Debt
Harden budget logic against window slicing and reset abuse.

### Scope
- Compute budget burn on short and long horizons simultaneously.
- Require both horizons to pass for `claim-responsiveness-pass`.
- Persist error-budget debt across context/session resets with bounded cooldown policy.

### Acceptance criteria
1. Window-gaming fixture fails with deterministic `error-budget-window-mismatch`.
2. Reset-abuse fixture fails with deterministic `budget-reset-abuse-detected`.
3. Healthy short+long horizon fixture passes with deterministic artifact hash.

---

## Task 2 — Validated-Completion Latency Semantics
Prevent synthetic low-latency spoofing from inflating responsiveness health.

### Scope
- Count latency SLI only for verification events with validated completion markers.
- Separate provisional outputs from completion-latency accounting.
- Hard-fail provisional-only fast outputs when used as responsiveness evidence.

### Acceptance criteria
1. Fast provisional/no-validation fixture fails with `latency-without-validation`.
2. Validated completion fixture contributes to latency SLI and can pass.
3. Identical input tuples produce deterministic verdict + reason.

---

## Task 3 — Warning-Debt + Sample-Accounting Integrity
Force escalation on chronic near-threshold operation and reject sample omission bias.

### Scope
- Accumulate warning debt across windows and escalate deterministically after threshold.
- Enforce expected-vs-observed sample counters; reject silent sample drops.
- Emit non-compensable integrity failures before pass/warn outcomes.

### Acceptance criteria
1. Threshold-hugging fixture escalates with `warning-debt-escalated`.
2. Sample-drop fixture fails with `sample-accounting-integrity-fail`.
3. Clean accounting + low debt fixture reaches pass/warn normally.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (dual-horizon budget evaluator + sticky debt handling + fixtures), no publish-path wiring in same change.
