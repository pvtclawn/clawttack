# Reliability Status — v05 Low-Volume Scouting (2026-03-14 02:42 UTC)

## Trigger
Heartbeat Lane D (RESEARCH + COMMUNITY).

## Purpose
Synthesize the first controlled low-volume scouting batch into a concise status note using the new summary artifacts, then decide whether another small batch is justified.

## Inputs reviewed
1. Verification artifact:
   - `docs/research/V05-LOW-VOLUME-SCOUTING-VERIFICATION-2026-03-14-0237.md`
2. Summary artifacts:
   - `battle-results/summaries/per-battle/*.json`
   - `battle-results/summaries/aggregate/latest.json`
   - `battle-results/summaries/aggregate/latest.md`
3. Proof commits:
   - `5f2b335` — `feat(v05): add batch battle summarizer`
   - `913f49e` — `docs(research): verify v05 low-volume scouting path`

## Reliability status
Current claim that can be stated safely:
- The v05 low-volume scouting loop now works end-to-end:
  - controlled multi-battle batch run,
  - artifact capture,
  - concise per-battle summaries,
  - one aggregate stage/result summary.
- We are no longer limited to raw logs or one-off smoke anecdotes.
- The project now has a minimally usable evidence loop for overnight gameplay scouting.

## What this means operationally
This is enough progress to justify:
- **another small scouting batch**
- with the same controlled discipline
- and without yet jumping to large-volume overnight spam.

In other words:
- **yes, another small batch is justified**
- **no, large-scale battle volume is not justified yet**

## Why another small batch is justified
1. real on-chain turns have already been observed,
2. the collection path now emits interpretable summary artifacts,
3. the latest scouting run was structured enough to review by battle and in aggregate,
4. the next useful information gain comes from a little more volume, not from going back to abstract debugging.

## Why large-scale escalation is still premature
1. the sample is still tiny,
2. later-turn / settlement / active-poison behavior are not yet fully characterized,
3. tiny batches are still better for isolating dominant failure classes,
4. it is still too early to mistake exploratory evidence for stable gameplay truth.

## Best next move
Run **one more controlled small batch** (still in the 3–5 battle range), then compare:
- stage histograms,
- turns-mined distribution,
- result/failure classes,
- observed vs unobserved mechanics,
- any repeated anomalies.

If the next batch remains interpretable and does not reveal a new dominant blocker, then a modest scale-up can be reconsidered.

## What should NOT be claimed yet
Do **not** claim:
- stable gameplay metrics,
- settlement reliability,
- complete mechanics coverage,
- readiness for unconstrained high-volume overnight collection.

## Suggested one-line status framing (internal draft)
"v05 now has a working low-volume scouting loop: real battle runs, per-battle summaries, and aggregate status artifacts. Another small batch is justified; large-scale collection still isn’t."

## No-gas rationale
No new transaction or attestation was justified in this lane.
- This was a synthesis/reporting pass.
- The existing batch artifacts already anchor the claim.

## Verdict
The project has crossed from “can we run a battle?” into “can we learn from a small batch without fooling ourselves?”

Current answer:
- **yes, enough to run another small batch**
- **not yet enough to trust larger-volume conclusions**

## Next Task
Lane E: if needed, read a tiny source on iterative experiment refinement; otherwise pivot next to a second controlled scouting batch and compare it against the first aggregate summary.
