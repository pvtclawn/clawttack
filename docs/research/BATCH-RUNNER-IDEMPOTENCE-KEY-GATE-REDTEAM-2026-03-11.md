# Batch Runner Idempotence-Key Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/084-BATCH-RUNNER-IDEMPOTENCE-KEY-GATE-PLAN-2026-03-11.md`

Goal: identify how idempotence-key gating can be gamed under noisy RPC, retries, and multi-runner pressure.

## Findings

### 1) Intent-hash laundering via under-specified payload binding
**Vector:** keep opKey stable while mutating a meaningful field not included in `intentHash` (e.g., gas policy, fee cap policy, expected block bound, downstream metadata).

**Failure mode:** mutated retries are treated as duplicates of the original safe intent even though operational meaning diverges.

**Mitigation:** enforce a canonical intent schema with strict field coverage + version pin (`intentSchemaVersion`), and fail on hash/input mismatch (`runner-op-intent-binding-invalid`).

---

### 2) Slot-scope confusion across create-battle target slots
**Vector:** craft semantically equivalent but non-canonical slot identifiers (`slot-7`, `007`, alias forms) or reuse a target slot across batch epochs.

**Failure mode:** duplicate create-intents evade dedupe because scope canonicalization is weak; or legitimate new intents are blocked due to alias collision.

**Mitigation:** canonicalize scope IDs before key derivation and include epoch/batch namespace in `battleScope` (`runner-op-scope-canonicalization-failed`).

---

### 3) Cross-runner replay race with stale dedupe state
**Vector:** two runners submit same opKey near-simultaneously while one reads stale dedupe cache.

**Failure mode:** both passes are accepted (split acceptance) or loser path appears as unrelated failure rather than deterministic duplicate/conflict.

**Mitigation:** compare-and-swap acceptance ledger with monotonic write token and deterministic conflict code (`runner-op-concurrent-conflict`).

---

### 4) Key-collision downgrade through weak domain separation
**Vector:** collision surface increases if key derivation omits operation domain/version, allowing accidental or adversarial cross-op collisions.

**Failure mode:** `accept-battle` key may collide with `claim-timeout`/`create-battle` under crafted tuples, causing false dedupe/mismatch outcomes.

**Mitigation:** domain-separate key derivation (`clawttack:runner-op:v1:<operationType>`) and include explicit type tag before hashing (`runner-op-domain-separation-invalid`).

---

### 5) Dedup ledger pruning abuse (time-window eviction)
**Vector:** attacker/race condition replays old op after TTL eviction while still within economic relevance window.

**Failure mode:** replayed operation is treated as fresh pass after dedupe eviction.

**Mitigation:** introduce operation-class-specific minimum retention windows + sticky tombstones for critical ops (`runner-op-replay-after-eviction`).

## Proposed hardening tasks
1. Intent binding integrity (canonical schema + version pin + full-field commitment).
2. Scope canonicalization + namespace discipline + domain-separated key derivation.
3. CAS-backed concurrent acceptance + retention/tombstone policy.

## Acceptance criteria for next lane
- Mutated retry with unchanged opKey seed fails `runner-op-intent-binding-invalid`.
- Alias/ambiguous scope input fails `runner-op-scope-canonicalization-failed`.
- Parallel same-key attempts yield one winner; loser deterministically gets `runner-op-concurrent-conflict`.
- Cross-op collision fixtures fail `runner-op-domain-separation-invalid`.
- Replay after TTL-prune but inside critical window fails `runner-op-replay-after-eviction`.
