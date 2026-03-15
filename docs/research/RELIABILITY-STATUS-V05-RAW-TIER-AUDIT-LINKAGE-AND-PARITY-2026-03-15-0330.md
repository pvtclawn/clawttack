# Reliability Status — v05 raw-tier audit linkage + parity direction (2026-03-15 03:30 UTC)

## Trigger
Lane D synthesis after:
- `18f016b` — `feat(v05): add audit-only raw tier linkage`
- `e62632d` — `docs(research): verify raw tier audit linkage`

## What is now evidence-backed
1. **The governed verdict block now shows both render-state and logic-state locally.**
   - `displayedTier` stays primary and cooled.
   - `rawTier` is visible and explicitly marked `audit-only`.
   - The mapping is local to the governed block rather than hidden elsewhere in the artifact.

2. **The cooled display label has not been reheated by the audit link on current artifact surfaces.**
   - In the verified exploratory case:
     - display = `non-credit / exploratory`
     - raw = `non-credit-unclassified`
   - In the verified invalid case:
     - display = `non-credit / invalid`
     - raw = `invalid-for-proper-battle`
   - Both cases remain clearly non-credit in the governed block.

3. **The main remaining risk is consistency, not local linkage.**
   - Within the governed block, the mapping is now explicit.
   - The next narrower risk is whether current artifact surfaces stay aligned in how they expose that mapping.

## Strongest honest status right now
> The governed verdict block now exposes cooled display labels and raw/internal tier state in a locally auditable way, and the next worthwhile refinement is parity/consistency across the current artifact surfaces rather than more new semantics.

## External-signal check
Search results remained generic rubric/transparency material, but the repeated useful theme was:
- transparency and consistency matter more than elegant wording,
- labels and criteria should stay aligned across visible evaluation surfaces.

That weakly supports the internal conclusion:
- the next slice should verify and, if needed, tighten markdown/json parity before chasing broader ecosystem surfaces.

## Narrowest remaining parity/consistency slice
1. **Current artifact-surface parity**
   - ensure JSON + markdown expose the same governed-block linkage semantics.

2. **Primary/secondary role consistency**
   - `displayedTier` remains primary,
   - `rawTier` remains audit-only,
   - neither surface inverts that relationship.

3. **No hidden warm phrasing on nearby artifact surfaces**
   - current verification should remain scoped to the existing artifact outputs,
   - not yet broader UI/log surfaces.

## Why this is the right next move
- The local audit-linkage problem is now materially solved for the governed block.
- The smallest remaining trust gap is whether the current surfaces present that solution consistently.
- Anything broader would be premature before current-surface parity is nailed down.

## Recommended next slice
Implement/verify markdown+JSON parity for the raw-tier audit linkage and document any remaining surface-specific caveats explicitly.

## On-chain classification
- No new tx justified for this synthesis lane.
- The value here is tightening the current render contract and avoiding quiet drift between artifact surfaces.
