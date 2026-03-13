# Applied Lessons — Replay Causal Release (2026-03-13 09:12 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Focused sections: happened-before / causality, monotonic vs wall-clock time, legal vs illegal state transitions, quorum-style safety gating, idempotence.

## Why this source is relevant
The current Clawttack replay-hardening slice is really a distributed-systems problem wearing protocol clothes:
- quarantined work is a partially recovered state,
- release decisions are order-sensitive,
- authority evidence can be stale or contradictory,
- retries are harmless only if replay application is idempotent end-to-end.

## Applied lessons

### 1) Causal eligibility is bounded evidence, not proof of full dependency closure
A prerequisite marker can show that some earlier event may have influenced a replay item, but that should not be overstated into proof of full transitive correctness.

**Applied rule:** keep current markers explicitly scoped to **direct prerequisite binding** unless stronger closure evidence exists.

### 2) Transitivity should not be inferred for free
Happened-before is transitive, but deriving transitive closure safely requires explicit information.

**Applied rule:** if Clawttack later supports transitive replay release, require a separate closure artifact or path digest. Do not let direct markers silently upgrade into transitive proof.

### 3) Monotonic time should remain the freshness basis for local recovery safety
Wall clocks can move backward; monotonic clocks cannot.

**Applied rule:** replay freshness, pause-revalidation thresholds, and suspicion windows should keep using monotonic elapsed time for local safety decisions, not wall-clock comparisons across components.

### 4) Quarantine is an illegal-but-recoverable state, not a license to guess
Failure recovery should move the system from an illegal state back to a legal one through explicit normal transitions.

**Applied rule:** unsupported independence claims, missing witnesses, and weak markers must remain blocked because they create cheap failure transitions from uncertainty into falsely legal release.

### 5) Safety-first resumption is the right default
When a participant cannot safely join a quorum, it should refrain.

**Applied rule:** when authority source / epoch / renewal generation are uncertain, replay recovery should inhibit release rather than optimize for liveness.

### 6) Replay correctness is incomplete without end-to-end idempotence
Validation alone is not enough. If side effects can apply twice, the system is still wrong.

**Applied rule:** the same digest used to authorize replay should also gate durable side-effect application, so retries cannot become duplicate effects.

## Concrete mechanism deltas suggested
1. Add explicit replay marker closure typing:
   - `closureLevel: 'direct-prerequisite' | 'transitive-verified'`
2. Keep release authorization tied to a fresh recovery witness:
   - `scopeKey`
   - `authoritySource`
   - `authorityEpoch`
   - `renewalGeneration`
3. Couple replay authorization and application idempotence:
   - same replay identity for both validation and durable apply
   - no "validated once, applied twice" gap

## Smallest next slice
The smallest next implementation worth shipping is:
- add `closureLevel` typing and tests proving that `direct-prerequisite` markers cannot be interpreted as transitive closure.

## Explicit caveat
This note does **not** prove that current replay logic is fully correct. It narrows the next design move:
- prefer bounded causal claims over implied closure,
- prefer inhibited action over optimistic release under uncertainty,
- keep deduplication coupled to actual side effects.
