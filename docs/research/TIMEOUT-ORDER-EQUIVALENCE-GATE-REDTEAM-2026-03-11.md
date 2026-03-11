# Timeout Order-Equivalence Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/096-TIMEOUT-ORDER-EQUIVALENCE-GATE-PLAN-2026-03-11.md`

Goal: identify how equivalence-class validation can be manipulated to make invalid orderings look acceptable.

## Findings

### 1) Forged precedence-constraint injection
**Vector:** attacker injects fake happened-before or real-time precedence edges into the constraint set.

**Failure mode:** validator marks manipulated order as equivalent while true causal constraints are violated.

**Mitigation:** authenticate/attest constraint provenance and reject untrusted edge sources (`timeout-order-constraint-invalid`).

---

### 2) Bucket-membership laundering
**Vector:** reclassify causally constrained events into concurrency buckets to relax ordering checks.

**Failure mode:** order that should fail causal checks passes as equivalent under broadened bucket assumptions.

**Mitigation:** enforce bucket membership derivation from authenticated dependency context and reject inconsistent bucket labels (`timeout-order-bucket-membership-invalid`).

---

### 3) Selective edge dropping
**Vector:** omit inconvenient precedence edges before equivalence evaluation.

**Failure mode:** invalid candidate order appears equivalent due to under-constrained graph.

**Mitigation:** require minimum constraint coverage and dependency completeness before equivalence decision (`timeout-order-constraint-incomplete`).

---

### 4) Real-time precedence laundering
**Vector:** manipulate nonconcurrent real-time precedence metadata (clock skew excuses, timestamp clipping) to bypass strict ordering.

**Failure mode:** nonconcurrent precedence violations are misclassified as valid equivalence.

**Mitigation:** classify uncertain real-time precedence explicitly and hard-fail tampered precedence metadata (`timeout-order-real-time-metadata-invalid`).

---

### 5) Equivalence replay across windows
**Vector:** replay previously valid equivalence verdict/artifact under newer window where constraints differ subtly.

**Failure mode:** stale equivalence acceptance suppresses newly introduced constraints.

**Mitigation:** bind equivalence evaluation to window/epoch nonce and invalidate stale artifact reuse (`timeout-order-equivalence-replay`).

## Proposed hardening tasks
1. Constraint provenance/authenticity checks + coverage completeness gate.
2. Bucket-membership derivation integrity + mismatch hard-fail.
3. Real-time metadata integrity + window-bound replay protection.

## Acceptance criteria for next lane
- Forged-constraint fixtures fail `timeout-order-constraint-invalid`.
- Bucket-membership laundering fixtures fail `timeout-order-bucket-membership-invalid`.
- Selective-edge-drop fixtures fail `timeout-order-constraint-incomplete`.
- Tampered real-time metadata fixtures fail `timeout-order-real-time-metadata-invalid`.
- Cross-window artifact replay fixtures fail `timeout-order-equivalence-replay`.
