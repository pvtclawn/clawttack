# 042 — Single-Writer Runner Lock Plan (2026-03-10)

## Context
Recent autonomous battle batches showed a clear ops bottleneck:
- overlapping runners competed for the same wallet nonce space,
- repeated `nonce too low` / `replacement underpriced` errors,
- battles created but not reliably progressed.

Narrative quality improved; orchestration safety did not.

## Objective
Add deterministic runner discipline so only one active writer controls tx submission for a given wallet/session domain at a time.

---

## Task 1 — Lock acquisition with monotonic fencing token (P0)
Implement a local lock artifact (file-backed) that issues a monotonically increasing token per successful acquisition.

### Acceptance criteria
- each acquisition emits strictly increasing token,
- lock holder identity + token are persisted atomically,
- stale holders cannot reassert ownership with older token.

---

## Task 2 — Submission gate bound to active token (P0)
All tx-submit paths must verify active lock token before sending.

### Acceptance criteria
- submit attempts without current token fail closed with deterministic reason,
- token mismatch forces self-terminate of stale runner,
- no dual-writer submit path passes in fixture simulation.

---

## Task 3 — Lease expiry + safe recovery path (P1)
Add bounded lease expiry/renewal for crash recovery while preserving fencing semantics.

### Acceptance criteria
- crashed holder can be recovered after lease expiry,
- recovery issues new higher token,
- expired holder cannot resume submits after takeover,
- deterministic recovery reason artifacts emitted.

---

## Next Task (single)
Implement **Task 1** in runner tooling (`packages/sdk/scripts`) with fixture-backed token monotonicity checks; no broad runtime refactor in the same PR.
