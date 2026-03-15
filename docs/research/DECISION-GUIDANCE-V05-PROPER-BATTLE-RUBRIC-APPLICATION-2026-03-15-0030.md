# Decision Guidance — v05 proper-battle rubric application (2026-03-15 00:30 UTC)

## Trigger
Lane E after classification-contract reliability synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-CLASSIFICATION-CONTRACT-2026-03-15-0025.md`

## Source touchpoint
- `books_and_papers/005_game_theory_fundamentals.pdf`
- Applied framing: do not let ambiguous outcomes receive the same payoff as clearly demonstrated success.

## Decision
For the next counted agent-path run, apply the minimal proper-battle rubric as an explicit pre-verdict checklist.

## Compact run guidance
Before a resumed agent-path run can be counted as a proper battle artifact, verify all of the following:

1. **Mode is explicit**
   - Mark the run as exactly one of:
     - `script-vs-script`
     - `agent-vs-script`
     - `agent-vs-agent`

2. **Source-of-move truth is explicit for both sides**
   - Neither side may be `unknown`.
   - If helper/fallback authorship is ambiguous, the run is exploratory only.

3. **Execution outcome is acceptable**
   - Must not be interruption / timeout / runner-error / supervisor ambiguity.
   - If execution is ambiguous, the artifact may still be useful, but not count as a proper battle.

4. **Gameplay outcome is acceptable**
   - Terminal state is the cleanest pass.
   - Non-terminal runs must remain explicitly exploratory, not rounded up to success.

5. **Transcript is legible and authentic enough**
   - No obvious seed-word slurry.
   - No obvious template/fallback masquerade.
   - Coherent enough to read as adversarial play rather than plumbing residue.

6. **Fail closed**
   - If any required evidence is missing, `countsAsProperBattle=false`.

## Suggested operator language for the next run note
- If the run clears every item above:
  - “This run counts as a proper battle artifact under the current rubric.”
- If it fails any item above:
  - “This run is useful evidence, but remains exploratory and does not yet count as a proper battle artifact.”

## Why this matters now
The recent work already did the hard honesty prep:
- parser-boundary recovery proved the live path is no longer blocked by that specific noisy-prefix failure,
- classification fields now prevent easy false positives.

The missing step is simply to apply the same honesty to the verdict boundary.

## What this guidance does **not** claim
- It does not claim the next run will pass.
- It does not claim terminal state is already reliable.
- It does not claim every live agent battle should now be counted.

## Recommended next slice
Implement this minimal proper-battle rubric directly in the artifact path, then run exactly one resumed agent-path battle against it.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane sharpens evidence discipline for the next counted run; it does not itself create a new gameplay artifact.
