# Timeout Concurrent-Bucket Commutativity Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/100-TIMEOUT-CONCURRENT-BUCKET-COMMUTATIVITY-GATE-PLAN-2026-03-11.md`

Goal: identify how commutativity/idempotence checks for concurrent timeout buckets can be bypassed or misled.

## Findings

### 1) Semantic-flag spoofing
**Vector:** attacker marks operations as commutative/idempotent in metadata while reducer semantics are actually order-sensitive.

**Failure mode:** noncommutative buckets pass classification and contaminate replay-equivalence assumptions.

**Mitigation:** derive semantic capability from authenticated reducer contract/version map (not self-declared flags) and fail mismatches (`timeout-bucket-semantic-flag-invalid`).

---

### 2) Witness laundering
**Vector:** provide cherry-picked A∘B/B∘A witnesses that ignore key side effects or hidden reducer branches.

**Failure mode:** bucket appears commutative on sampled paths while diverging on omitted paths.

**Mitigation:** require canonical witness schema with mandatory side-effect fields and branch coverage floor (`timeout-bucket-witness-incomplete`).

---

### 3) Partial pair-check bypass
**Vector:** in an N-event bucket, attacker validates only selected operation pairs and skips problematic combinations.

**Failure mode:** pairwise noncommutativity remains undetected.

**Mitigation:** enforce complete pair matrix (or proven safe partition strategy) and fail missing pair checks (`timeout-bucket-pair-coverage-incomplete`).

---

### 4) Order-sensitive state coupling masked as commutative
**Vector:** operations look commutative on terminal hash but diverge in intermediate risk/milestone state.

**Failure mode:** gate over-accepts based on terminal-only equality.

**Mitigation:** include milestone/state-transition parity checks in commutativity witness (`timeout-bucket-milestone-divergence`).

---

### 5) Duplicate-apply instability under at-least-once semantics
**Vector:** operation pair is commutative but non-idempotent; retries/replays change outcome unexpectedly.

**Failure mode:** commutativity pass is misinterpreted as full safety under retry conditions.

**Mitigation:** require explicit idempotence proof when at-least-once delivery is in scope (`timeout-bucket-idempotence-missing`).

## Proposed hardening tasks
1. Authenticated semantic-capability derivation + flag mismatch hard-fail.
2. Witness completeness/coverage requirements (side effects + branches + pair matrix).
3. Milestone parity + idempotence requirement enforcement for retryable paths.

## Acceptance criteria for next lane
- Semantic-flag spoof fixtures fail `timeout-bucket-semantic-flag-invalid`.
- Witness-laundering fixtures fail `timeout-bucket-witness-incomplete`.
- Partial pair-check fixtures fail `timeout-bucket-pair-coverage-incomplete`.
- Terminal-only convergence with milestone divergence fixtures fail `timeout-bucket-milestone-divergence`.
- Retry-scope non-idempotent fixtures fail `timeout-bucket-idempotence-missing`.
