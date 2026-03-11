# Timeout Safety-Priority Decision Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/104-TIMEOUT-SAFETY-PRIORITY-DECISION-GATE-PLAN-2026-03-11.md`

Goal: identify how safety-priority timeout decisions can be gamed so risky decisions are misclassified as safe.

## Findings

### 1) Risk-score laundering
**Vector:** attacker manipulates or downweights contradiction-risk inputs (source weighting abuse, missing evidence penalties removed) to force low-risk classification.

**Failure mode:** high-risk situations incorrectly pass as `timeout-safety-priority-pass`.

**Mitigation:** enforce risk-score provenance + monotonic risk floor under missing/conflicting evidence (`timeout-safety-risk-score-invalid`).

---

### 2) Confidence inflation attack
**Vector:** duplicate/correlated sources are counted as independent confirmations, inflating confidence.

**Failure mode:** ambiguous evidence appears high-confidence and bypasses hold behavior.

**Mitigation:** confidence de-duplication by source-correlation groups and anti-inflation caps (`timeout-safety-confidence-inflated`).

---

### 3) Contradictory-source masking
**Vector:** contradictory probes are suppressed/omitted so agreement metric appears stronger than reality.

**Failure mode:** decisions proceed when they should hold due to unresolved contradiction.

**Mitigation:** required-source coverage and contradiction visibility checks (`timeout-safety-contradiction-hidden`).

---

### 4) Hold-bypass policy abuse
**Vector:** policy flags (urgent mode/override) are used to skip hold outcomes without auditable justification.

**Failure mode:** unsafe non-hold actions are emitted under high contradiction risk.

**Mitigation:** explicit override proof requirement + deterministic violation on missing proof (`timeout-safety-hold-bypass-invalid`).

---

### 5) Threshold drift replay
**Vector:** stale threshold configuration replayed from earlier window/environment to downgrade current risk.

**Failure mode:** decisions use outdated safety policy and pass when current policy would hold/fail.

**Mitigation:** bind thresholds to versioned policy digest and reject stale mismatches (`timeout-safety-threshold-version-stale`).

## Proposed hardening tasks
1. Risk/confidence provenance integrity with correlation-aware confidence controls.
2. Contradiction visibility + required-source coverage guard.
3. Override-proof enforcement + policy-version freshness checks.

## Acceptance criteria for next lane
- Risk-score laundering fixtures fail `timeout-safety-risk-score-invalid`.
- Confidence inflation fixtures fail `timeout-safety-confidence-inflated`.
- Contradictory-source masking fixtures fail `timeout-safety-contradiction-hidden`.
- Hold-bypass abuse fixtures fail `timeout-safety-hold-bypass-invalid`.
- Threshold replay fixtures fail `timeout-safety-threshold-version-stale`.
