# Reliability Status — v05 Second Scouting Batch (2026-03-14 03:07 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY).

## Purpose
Synthesize the second controlled scouting batch using the new comparison-aware summary tooling and decide whether another same-regime replication is still the best next move.

## Inputs reviewed
1. Verification artifact:
   - `docs/research/V05-SECOND-SCOUTING-BATCH-VERIFICATION-2026-03-14-0302.md`
2. Current summary artifacts:
   - `battle-results/summaries/aggregate/latest.json`
   - `battle-results/summaries/aggregate/latest.md`
   - `battle-results/summaries/aggregate/comparison-latest.json`
   - recent `battle-results/summaries/per-battle/*.json`
3. Proof commits:
   - `b4f3b26` — `feat(v05): compare scouting batches`
   - `4a38688` — `docs(research): verify v05 second scouting batch`

## Reliability status
Current claim that can be stated safely:
- the comparison-aware scouting loop now works,
- repeated same-regime low-volume collection is possible,
- and the project now has enough batch-over-batch evidence to compare *how* runs behave, not just whether they run at all.

This is real progress.

## What the second scouting batch means
The important shift is not just "another batch completed." It is:
- the latest batch can now be compared against the previous scouting batch,
- unsettled/active battle accounting is explicit,
- observed vs unobserved mechanics remain visible,
- and repeated patterns can be discussed with more discipline than before.

## Decision
### Another identical same-regime batch?
**Probably lower-value now.**

### Better next move?
**Variation and/or targeted instrumentation is now more informative than another identical replication batch.**

## Why
The project has already demonstrated enough same-regime repetition to show that:
- v05 can create/accept,
- turns can mine,
- the low-volume scouting loop works,
- summaries and comparison artifacts refresh correctly.

At this point, another unchanged batch is more likely to add:
- more of the same narrow-regime evidence,

than to answer the next important questions, such as:
- later-turn / active-poison behavior,
- settlement behavior,
- whether first-mover or side asymmetry matters,
- whether a small parameter change exposes new mechanics.

## Honest recommendation
The next move should be one of these, in order of usefulness:
1. **parameter variation** on the next small batch
   - e.g. slightly different turn limits / warmup / batch conditions if safe
2. **targeted instrumentation**
   - especially around later-turn behavior, poison activation, and settlement visibility
3. only then, if needed, another same-regime replication batch

## What should NOT be claimed yet
Do **not** claim:
- broad gameplay robustness,
- stable rate estimates,
- settlement reliability,
- complete later-turn mechanics coverage,
- readiness for larger-volume scaling.

## Suggested one-line status framing (internal draft)
"The second scouting batch confirms the comparison-aware evidence loop works. Another identical batch is now lower-value; the smarter next step is a small parameter/instrumentation pivot to expose mechanics the current regime still isn’t showing."

## No-gas rationale
No new transaction or attestation was justified in this lane.
- This was a synthesis/reporting pass.
- The existing scouting batch and comparison artifacts already anchor the current claim.

## Verdict
The right question is no longer "can we run another same batch?"
It is:
- **what small change will teach us something new?**

That means the next step should favor **controlled variation or better instrumentation** over blind repetition.

## Next Task
Lane E: read a tiny targeted source on experiment variation / intervention design if needed; otherwise pivot the next build/verify slice to a small, explicit batch-parameter or instrumentation variation rather than a third identical scouting run.
