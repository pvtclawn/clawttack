# Safe Resumption Learning — Freshness Authority Pause/Resume Gap (2026-03-12 22:07 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/006_think_distributed_systems.pdf`
- Relevant extracted ideas:
  - recovery/replay must reconstruct correctness from durable state,
  - paused or restarted execution should not assume prior in-memory assumptions still hold,
  - durable execution/resumption works only when resumed work is checked against current state/history.

## Extracted lesson
The practical lesson is: **resume is a re-entry boundary, not proof of continuity**. A process that wakes up after pause, suspension, or restart may still hold locally plausible state, but that state is no longer trustworthy until it is checked against current durable authority history.

## Applied interpretation for Clawttack
Our timer-bound freshness lease guard already models one piece of this by denying work after excessive pause duration. The remaining live pause/resume gap is broader:
- queued/admitted work from before pause may still exist,
- the runtime may wake up with stale assumptions about current authority/renewal generation,
- resumption should therefore trigger **revalidation**, not immediate continuation.

## Concrete mechanism delta
Treat pause/resume as an explicit authority re-entry contract.

### A. Resume requires authority revalidation
On resume/restart, authoritative append service should re-check:
- current authority epoch,
- current renewal generation,
- current seal/uncertainty state,
- current authority provenance/source.

### B. Pre-pause admitted work is quarantined until revalidated
Queued or in-flight work admitted before the pause should not execute immediately on resume. It must prove that its observed generation/epoch still matches current state.

### C. Successful re-entry is state-based, not time-based
Elapsed time can trigger suspicion, but the real resume decision must still be based on current authority state, not on an assumption that “the pause was short enough.”

## Why this narrows the remaining live gap
- **Pause safety**: stale pre-pause work does not silently resume into stale authority.
- **Recovery discipline**: restart becomes a point of explicit authority proof, not a laundering step for old assumptions.
- **Lease realism**: local timer discipline is complemented by a strong re-entry rule when execution continuity is broken.

## Deterministic next-step criteria
1. **Resume triggers revalidation**
   - resumed authoritative path checks current epoch/generation/seal state before continuing.
2. **Queued pre-pause work is quarantined**
   - pre-pause work cannot execute until revalidated.
3. **Stale pre-pause work denied**
   - mismatched current generation/epoch causes deterministic denial.
4. **Fresh current state restores service**
   - if current authority state matches, queued work may proceed.
5. **Restart is not a free reset of suspicion**
   - restart alone does not clear stale authority assumptions.

## Explicit caveat
This is still a learning/design artifact. It does not prove real process-pause detection, live suspension handling, or end-to-end runtime recovery correctness.

## Recommended next slice
Red-team and/or plan a **resume-revalidation contract** that explicitly quarantines pre-pause work and requires current authority proof before resuming authoritative append.
