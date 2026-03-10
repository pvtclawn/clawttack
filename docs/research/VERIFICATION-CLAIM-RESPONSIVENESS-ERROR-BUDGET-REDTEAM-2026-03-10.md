# Verification-Claim Responsiveness Error-Budget Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/056-VERIFICATION-CLAIM-RESPONSIVENESS-ERROR-BUDGET-PLAN-2026-03-10.md`

Goal: identify how responsiveness/error-budget controls can be satisfied superficially while real verification quality or operational reliability degrades.

## Findings

### 1) Metric-window gaming
**Vector:** split or defer heavy/error-prone work so poor samples fall outside active window.

**Failure mode:** `claim-responsiveness-pass` appears while true operating behavior exceeds budget over longer horizon.

**Mitigation:** dual-horizon budget checks (short + cumulative) with deterministic reason `error-budget-window-mismatch`.

---

### 2) Synthetic low-latency spoofing
**Vector:** emit fast provisional outputs before actual verification completes.

**Failure mode:** latency SLI appears healthy but semantic verification is not complete.

**Mitigation:** count latency only for validated-completion events; fail with `latency-without-validation`.

---

### 3) Warning suppression by threshold hugging
**Vector:** maintain oscillation just below warning threshold to avoid escalation.

**Failure mode:** persistent near-degraded mode never trips hard attention signals.

**Mitigation:** warning-debt accumulator + escalation rule; emit `warning-debt-escalated`.

---

### 4) Selective sample dropping
**Vector:** omit or down-weight bad observations from SLI totals.

**Failure mode:** optimistic bias in error-rate computation.

**Mitigation:** sample-accounting integrity checks with expected/observed counters; fail `sample-accounting-integrity-fail`.

---

### 5) Budget reset abuse
**Vector:** rotate context/session IDs to reset debt and avoid cumulative budget consequences.

**Failure mode:** repeated degradation episodes never cross budget threshold in any single context.

**Mitigation:** sticky debt carryover across resets with cooldown gates; fail `budget-reset-abuse-detected`.

## Proposed hardening tasks
1. Add dual-horizon budget accounting + sticky debt across context resets.
2. Bind responsiveness latency SLIs to validated completion events only.
3. Add warning-debt + sample-accounting integrity enforcement.

## Acceptance criteria for next lane
- Window-gaming fixture fails deterministically.
- Fast provisional/no-validation fixture fails deterministically.
- Threshold-hugging fixture escalates deterministically.
- Sample-drop fixture fails deterministic integrity checks.
- Reset-abuse fixture fails with sticky-debt detection.
