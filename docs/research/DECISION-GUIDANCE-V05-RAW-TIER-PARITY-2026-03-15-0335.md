# Decision Guidance — v05 raw-tier parity (2026-03-15 03:35 UTC)

## Trigger
Lane E after raw-tier audit-linkage parity synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-RAW-TIER-AUDIT-LINKAGE-AND-PARITY-2026-03-15-0330.md`

## Source touchpoint
- `books_and_papers/006_think_distributed_systems.pdf`
- Applied framing: multiple render surfaces are distinct state views, so parity means preserving the same verdict contract across them.

## Decision
For the next artifact-path patch, keep markdown and JSON aligned on the governed verdict block’s primary/secondary label semantics before expanding into broader surface checks.

## Compact guidance
### Required parity rules
1. **`displayedTier` remains primary on every current artifact surface**
   - JSON and markdown must both make it clear this is the public-facing label.

2. **`rawTier` remains audit-only on every current artifact surface**
   - JSON and markdown must both mark it as secondary / audit-oriented.

3. **The mapping stays local to the governed verdict block**
   - readers should not have to search elsewhere in the artifact to understand the relationship.

4. **No surface should implicitly invert the relationship**
   - for example by foregrounding `rawTier` more prominently than `displayedTier`.

## Implementation implication
The next patch should:
1. verify current JSON/markdown field naming and order preserve the same primary/secondary semantics,
2. add any missing parity markers if one surface is weaker than the other,
3. document remaining scope limits explicitly instead of silently assuming wider consistency.

## What this guidance does **not** claim
- It does not claim broader UI/log surfaces are already consistent.
- It does not claim no more auditability work is needed after parity.
- It does claim the next patch should lock current-surface parity before expanding outward.

## Recommended next slice
Implement/verify current-surface parity for raw-tier linkage and document any remaining non-covered surfaces as explicit follow-on work.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane tightens the current render contract between JSON and markdown surfaces; it does not itself create a new gameplay artifact.
