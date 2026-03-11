# Timeout Logical-Order Normalization Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/094-TIMEOUT-LOGICAL-ORDER-NORMALIZATION-GATE-PLAN-2026-03-11.md`

Goal: identify ways deterministic normalization can be manipulated to hide causal problems or create unstable replay results.

## Findings

### 1) Concurrent-bucket poisoning
**Vector:** attacker injects low-signal/noisy events into concurrent buckets to dilute or mask high-risk causal events.

**Failure mode:** normalization still returns deterministic bucket structure, but downstream logic underweights critical events due to bucket overload.

**Mitigation:** enforce bucket quality constraints and critical-event precedence labels (`timeout-logical-bucket-poisoned`).

---

### 2) Tie-break manipulation
**Vector:** craft event IDs/metadata to win deterministic tie-break order within otherwise equivalent events.

**Failure mode:** attacker steers canonical order toward favorable downstream interpretation while staying “deterministic.”

**Mitigation:** use domain-separated, semantics-aware tie-break keys and reject adversarial/non-canonical tie-break fields (`timeout-logical-tiebreak-invalid`).

---

### 3) Inconsistent-graph laundering via partial edge sets
**Vector:** provide selectively pruned dependency edges so cycles/contradictions are hidden and appear as benign concurrency.

**Failure mode:** true inconsistency is downgraded to concurrent-bucket output.

**Mitigation:** require edge completeness proofs or minimum dependency coverage before allowing concurrent classification (`timeout-logical-graph-incomplete`).

---

### 4) Cross-scope normalization grafting
**Vector:** merge events from adjacent operation scopes with similar logical timestamps.

**Failure mode:** normalized output includes foreign events that satisfy ordering but violate scope integrity.

**Mitigation:** strict scope anchoring (`chainId|arena|operationId`) per event before normalization (`timeout-logical-scope-mismatch`).

---

### 5) Replay of normalized outputs across windows
**Vector:** replay previously normalized results into a newer processing window when IDs overlap.

**Failure mode:** stale normalized order is treated as current, suppressing fresh causal conflicts.

**Mitigation:** window/epoch nonce binding for normalized output identity + replay cache checks (`timeout-logical-normalization-replay`).

## Proposed hardening tasks
1. Critical-event precedence + bucket quality guard.
2. Semantics-aware tie-break hardening + canonical field contract.
3. Edge completeness checks + inconsistent-graph detection hard-fail.
4. Strict scope anchoring + window-bound replay protection.

## Acceptance criteria for next lane
- Bucket-poisoning fixtures fail `timeout-logical-bucket-poisoned`.
- Tie-break manipulation fixtures fail `timeout-logical-tiebreak-invalid`.
- Partial-edge laundering fixtures fail `timeout-logical-graph-incomplete`.
- Cross-scope graft fixtures fail `timeout-logical-scope-mismatch`.
- Normalization replay fixtures fail `timeout-logical-normalization-replay`.
