# Decision Guidance — v05 anti-spin summary blocks (2026-03-15 02:00 UTC)

## Trigger
Lane E after anti-spin summary-rule synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-REASON-PRIORITY-AND-ANTI-SPIN-BLOCKS-2026-03-15-0155.md`

## Source touchpoint
- `books_and_papers/006_think_distributed_systems.pdf`
- Applied framing: keep the structured verdict boundary separate from adjacent prose so one local state does not silently mutate another.

## Decision
For the next artifact-path patch, treat the immediate summary block as a constrained rendering of structured verdict state, not as a freeform interpretation zone.

## Compact guidance
### Anti-spin rules below `proper-battle`
1. **Immediate summary block must stay non-promotional**
   - no positive adjectives like `strong`, `promising`, `compelling`, `impressive`, `encouraging`.

2. **First clause must be quote-safe**
   - if copied alone, it should still sound non-credit and non-celebratory.

3. **One selected caveat/trigger must remain in the same sentence**
   - sourced from `topClaimLimitingReason` or `topHardInvalidTrigger`.

4. **No follow-up sentence in the immediate summary block may soften the verdict**
   - no “despite this,” “still useful overall,” “good evidence anyway,” or equivalent warming language.

5. **Richer interpretation belongs outside the immediate summary block**
   - later sections may analyze or contextualize,
   - but the verdict block itself must remain a tight rendering of structured state.

## Suggested operator-safe templates
### `exploratory-high-value`
> This run is exploratory evidence only and does not count as a proper battle artifact; main caveat: `<topClaimLimitingReason>`.

### `exploratory-limited`
> This run produced limited exploratory evidence and does not count as a proper battle artifact; main caveat: `<topClaimLimitingReason>`.

### `invalid-for-proper-battle`
> This run is invalid for proper-battle credit under the current rubric; main trigger: `<topHardInvalidTrigger>`.

## Implementation implication
The next patch should:
1. generate the immediate summary block from structured verdict state only,
2. ban promotional wording for lower tiers,
3. require the selected caveat/trigger in the same sentence,
4. keep richer narrative commentary outside the block.

## What this guidance does **not** claim
- It does not claim the summary block alone solves all overclaiming.
- It does not claim readable+raw reason pairing is already done.
- It does claim the next patch should close the biggest remaining rhetorical leak.

## Recommended next slice
Implement the anti-spin immediate summary block rules directly in the artifact path, then verify the rendered block stays quote-safe and caveat-adjacent for lower tiers.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane tightens the rendering boundary for future battle artifacts; it does not itself create a new gameplay artifact.
