# Timeout Replay-Equivalence Witness Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/098-TIMEOUT-REPLAY-EQUIVALENCE-WITNESS-GATE-PLAN-2026-03-11.md`

Goal: identify how replay-equivalence witnessing can be gamed to make non-equivalent histories appear convergent.

## Findings

### 1) Reducer-version spoofing
**Vector:** attacker supplies a forged/aliased reducer signature so both histories are replayed under a different reducer than expected.

**Failure mode:** witness emits `timeout-replay-equivalent` under wrong reducer semantics.

**Mitigation:** bind evaluator to authenticated reducer identity/version digest and reject mismatch (`timeout-replay-reducer-version-invalid`).

---

### 2) Trace-hash laundering
**Vector:** manipulate trace serialization/canonicalization so distinct traces hash to same normalized form.

**Failure mode:** divergent execution traces appear equal by hash-only comparison.

**Mitigation:** enforce canonical trace schema with strict field coverage and compare structured trace invariants before hashing (`timeout-replay-trace-canonicalization-invalid`).

---

### 3) Nondeterministic-field smuggling
**Vector:** include unstable fields (wall-clock timestamps, random IDs, process-local counters) inside candidate histories.

**Failure mode:** evaluator may classify divergence as legitimate or hide instability behind normalization shortcuts.

**Mitigation:** explicit nondeterministic-field denylist + deterministic input contract validation (`timeout-replay-nondeterministic-input`).

---

### 4) Context-tuple drift across replays
**Vector:** replay two histories with slightly different context tuple (chain/arena/operation scope/version flags).

**Failure mode:** apparent convergence is meaningless because evaluations were not run in identical context.

**Mitigation:** strict context tuple equality requirement before replay witness (`timeout-replay-context-mismatch`).

---

### 5) Terminal-hash-only equivalence abuse
**Vector:** craft histories that converge to same terminal hash but diverge in intermediate decision path critical to risk scoring.

**Failure mode:** evaluator over-accepts equivalence when terminal-only check is used.

**Mitigation:** require terminal hash + decision-trace hash + key milestone parity checks (`timeout-replay-milestone-divergence`).

## Proposed hardening tasks
1. Authenticated reducer identity/version lock + context tuple equality gate.
2. Canonical structured trace validation before hashing.
3. Nondeterministic-field contract enforcement + milestone-parity checks.

## Acceptance criteria for next lane
- Reducer-version spoof fixtures fail `timeout-replay-reducer-version-invalid`.
- Trace canonicalization laundering fixtures fail `timeout-replay-trace-canonicalization-invalid`.
- Nondeterministic-field smuggling fixtures fail `timeout-replay-nondeterministic-input`.
- Context-tuple drift fixtures fail `timeout-replay-context-mismatch`.
- Terminal-only convergence but milestone divergence fixtures fail `timeout-replay-milestone-divergence`.
