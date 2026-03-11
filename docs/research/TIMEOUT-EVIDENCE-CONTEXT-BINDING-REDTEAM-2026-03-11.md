# Timeout Evidence Context-Binding Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/088-TIMEOUT-EVIDENCE-CONTEXT-BINDING-GATE-PLAN-2026-03-11.md`

Goal: identify ways context-bound timeout evidence can be replayed, re-scoped, or misclassified under realistic RPC turbulence.

## Findings

### 1) Canonicalization collision abuse
**Vector:** exploit weak normalization (`providerId`, `arena`, `operationId`) via alias forms, case/whitespace tricks, unicode confusables, or checksum/non-checksum address variants.

**Failure mode:** distinct scopes collapse to same canonical tuple, enabling cross-scope replay to appear valid.

**Mitigation:** enforce strict canonical grammar + reject ambiguous aliases before hashing (`timeout-evidence-canonicalization-invalid`).

---

### 2) Counter-window desynchronization laundering
**Vector:** submit evidence with stale or future counters around window rollover boundaries while presenting seemingly valid window IDs.

**Failure mode:** replayed evidence bypasses freshness checks if counter/window progression logic is non-monotonic or race-prone.

**Mitigation:** require monotonic `(windowId,counter)` progression with deterministic rollover contract and reject regressions/skips (`timeout-evidence-counter-window-invalid`).

---

### 3) Provider-identity alias spoofing
**Vector:** attacker maps multiple provider aliases to one backend (or impersonates provider IDs) to fake independent evidence diversity.

**Failure mode:** gate overestimates evidence independence and accepts correlated replay paths.

**Mitigation:** bind provider identity to authenticated provider fingerprint/class and reject unbound aliases (`timeout-evidence-provider-identity-invalid`).

---

### 4) Context grafting across operation classes
**Vector:** reuse valid timeout evidence from one operation type (`claim-timeout`) against another (`accept-battle`) where high-level identifiers partially overlap.

**Failure mode:** evidence appears context-consistent if operation-type domain separation is missing/incomplete.

**Mitigation:** domain-separate context tuple with explicit operation-class tag and mismatch hard-fail (`timeout-evidence-operation-scope-mismatch`).

---

### 5) Replay after cache/ledger eviction
**Vector:** replay old evidence after local replay-cache eviction while chain state remains economically relevant.

**Failure mode:** stale evidence re-enters as fresh due to insufficient retention policy.

**Mitigation:** sticky replay tombstones for active windows and minimum retention horizon by operation class (`timeout-evidence-replay-after-eviction`).

## Proposed hardening tasks
1. Canonicalization strictness + operation-class domain separation.
2. Monotonic counter-window progression with rollover invariants.
3. Provider identity authenticity/fingerprint binding + anti-alias checks.
4. Replay retention/tombstone policy for active windows.

## Acceptance criteria for next lane
- Alias/canonicalization collision fixtures fail `timeout-evidence-canonicalization-invalid`.
- Counter-window desync fixtures fail `timeout-evidence-counter-window-invalid`.
- Provider alias spoof fixtures fail `timeout-evidence-provider-identity-invalid`.
- Cross-operation graft fixtures fail `timeout-evidence-operation-scope-mismatch`.
- Replay-after-eviction fixtures fail `timeout-evidence-replay-after-eviction`.
