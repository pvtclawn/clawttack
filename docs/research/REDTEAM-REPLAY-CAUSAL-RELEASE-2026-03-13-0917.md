# Red-Team — Replay Causal Release (2026-03-13 09:17 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the current replay causal-release direction after the latest hardening + verification + learning notes.

Reference artifacts:
- `docs/research/REPLAY-DEPENDENCY-MARKER-HARDENING-VERIFICATION-2026-03-13-0904.md`
- `docs/research/APPLIED-LESSONS-REPLAY-CAUSAL-RELEASE-2026-03-13-0912.md`

## Core question
**Why might the current direction still fail even if the recent replay-hardening slice is locally correct?**

## Weaknesses and exploit paths

### 1) Direct-prerequisite evidence may be overclaimed as transitive closure
The current marker model is good for direct prerequisite binding, but unsafe if future logic silently upgrades that into full dependency closure.

**Exploit path:**
- provide a valid direct prerequisite marker,
- omit intermediate dependency edges,
- let release logic or operators infer too much from too little,
- resume work on a branch that is locally plausible but globally stale.

**Mitigation:**
- introduce `closureLevel: 'direct-prerequisite' | 'transitive-verified'`,
- deny any path that treats the weaker level as the stronger one.

### 2) Structurally valid witnesses can still be semantically stale under concurrent recovery
Source/epoch/generation checks are necessary but may still be insufficient when recovery context moves concurrently.

**Exploit path:**
- witness looks current at assessment time,
- recovery frontier advances before apply time,
- release proceeds on a stale branch anyway.

**Mitigation:**
- add a recovery-frontier / closure digest,
- require an apply-time still-current check, not only an assessment-time match.

### 3) Authorization can still diverge from side-effect application
The current slice reasons about release authorization, not end-to-end exactly-once side effects.

**Exploit path:**
- replay is authorized,
- process crashes before durable apply record is safely linked,
- retry re-applies side effect,
- system is now semantically wrong even if validation looked correct.

**Mitigation:**
- bind authorization, durable apply record, and retry deduplication to the same replay identity/digest,
- reject duplicate applies transactionally.

### 4) Work-class allowlists are vulnerable if class assignment is mutable or weakly audited
Independent-release gating is only as trustworthy as the path that assigns `workClass`.

**Exploit path:**
- dependency-sensitive work is relabeled as a safe diagnostic class,
- stronger causal checks are skipped,
- release becomes a metadata-laundering problem instead of a marker-forgery problem.

**Mitigation:**
- hash/sign-bind `workClass` into replay identity,
- treat relabel as a new work item with audit trail, not an in-place mutation.

### 5) The mechanism can become safe-but-boring
An overcautious replay model may collapse practical replay into trivial safe classes and keep richer work quarantined forever.

**Why this matters for Clawttack:**
The product target is not only safety; it is also meaningful, legible, strategically rich adversarial behavior. A system that only safely resumes trivial work may be correct but still strategically dead.

**Mitigation:**
- measure replay release composition by work class,
- track whether replay paths are collapsing into only trivial safe classes,
- build operator/runtime affordances that make richer valid replay practical instead of prohibitively complex.

## Best next actions
1. **Build:** add closure-level typing and tests proving direct markers cannot imply transitive closure.
2. **Build:** bind replay authorization to durable apply idempotence.
3. **Verify:** add a challenge fixture for concurrent stale-witness / apply-time frontier drift.
4. **Measure:** add a metric for replay release distribution by work class so "safe-but-boring" regressions become visible.

## Verdict
The latest hardening slice is good, but the next serious risks are now:
- semantic overclaim of closure,
- stale witness under concurrent recovery,
- idempotent-apply gap,
- class-label laundering,
- boring-equilibrium collapse.

## Explicit caveat
This red-team note critiques the current direction to improve it. It does **not** mean the latest slice was wasted; it means the slice narrowed one set of failure paths and exposed the next ones more clearly.
