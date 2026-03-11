# Timeout Causal-Ordering Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/092-TIMEOUT-CAUSAL-ORDERING-GATE-PLAN-2026-03-11.md`

Goal: identify how causal-ordering checks can be gamed to misclassify concurrent or invalid timeout evidence as safely ordered.

## Findings

### 1) Forged dependency-edge injection
**Vector:** attacker injects fake predecessor links so an event appears causally justified.

**Failure mode:** invalid event chain is accepted as `timeout-causal-order-pass`.

**Mitigation:** require dependency-edge authenticity (signed/source-bound edge metadata) and reject unverifiable edges (`timeout-causal-edge-invalid`).

---

### 2) Logical-timestamp inflation attack
**Vector:** malicious node inflates logical timestamps to dominate ordering and force downstream events to appear stale/concurrent.

**Failure mode:** ordering skew biases verdicts and can suppress valid counter-evidence.

**Mitigation:** constrain logical timestamp deltas per source and detect abnormal jumps (`timeout-causal-ts-inflation`).

---

### 3) Concurrency laundering via selective edge omission
**Vector:** omit optional-but-relevant dependencies so conflicts degrade into harmless concurrency labels.

**Failure mode:** true causality violation is downgraded to `timeout-causal-order-concurrent`.

**Mitigation:** enforce required dependency completeness by operation class and fail incomplete causal context (`timeout-causal-context-incomplete`).

---

### 4) Cross-scope event grafting
**Vector:** splice events from neighboring operation scopes with similar timing/signatures.

**Failure mode:** foreign events satisfy ordering checks without belonging to the same operation context.

**Mitigation:** bind causal graph nodes to strict scope tuple (`chainId|arena|operationId`) and reject grafts (`timeout-causal-scope-mismatch`).

---

### 5) Replay of historical causal bundles
**Vector:** resubmit previously valid causal bundles into a later window when graph IDs are weakly fresh.

**Failure mode:** stale causality appears valid under reused identifiers.

**Mitigation:** include freshness epoch/window nonce in graph identity and reject replayed bundles (`timeout-causal-replay-detected`).

## Proposed hardening tasks
1. Dependency-edge authenticity + required-context completeness gate.
2. Source-bounded logical-timestamp drift/inflation guard.
3. Scope-anchored graph identity + replay-resistance window binding.

## Acceptance criteria for next lane
- Forged-edge fixtures fail `timeout-causal-edge-invalid`.
- Timestamp inflation fixtures fail `timeout-causal-ts-inflation`.
- Missing-dependency fixtures fail `timeout-causal-context-incomplete`.
- Cross-scope graft fixtures fail `timeout-causal-scope-mismatch`.
- Historical bundle replay fixtures fail `timeout-causal-replay-detected`.
