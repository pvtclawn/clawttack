# Decision Guidance — v05 audit linkage for cool labels (2026-03-15 03:00 UTC)

## Trigger
Lane E after cool-label audit-linkage synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-COOL-LABELS-AND-AUDIT-LINKAGE-2026-03-15-0255.md`

## Source touchpoint
- `books_and_papers/006_think_distributed_systems.pdf`
- Applied framing: render state and logic state can differ safely only when the boundary and mapping between them are explicit.

## Decision
For the next artifact-path patch, expose explicit audit linkage from the cooled governed-block display label back to the raw/internal tier state.

## Compact guidance
### Goals
1. keep the visible governed-block label cool and downgrade-first,
2. make the raw/internal tier state auditable from the same artifact,
3. avoid creating a public truth vs private truth split.

### Rules
- display label stays optimized for low prestige leakage,
- raw/internal tier code remains visible for audit,
- the mapping between them should be explicit and local,
- do not rewarm the display label just to explain the linkage.

### Candidate implementation direction
Inside `governedVerdictBlock` or immediately adjacent fields:
- keep:
  - `displayedTier`
- add something like:
  - `rawTier`
  - or `internalTierCode`
- keep the two side-by-side in rendered output so readers can see both:
  - cooled display label
  - raw/internal tier state

## Why this matters now
The cooled labels already reduced visible prestige leakage.
The next risk is hidden divergence:
- maintainers see one truth,
- readers see another,
- and the system quietly becomes harder to audit.

Explicit linkage fixes that without undoing the cooler display surface.

## What this guidance does **not** claim
- It does not claim audit linkage solves all cross-surface consistency problems.
- It does not claim internal tier names must be renamed now.
- It does claim the next patch should make the cooled label traceable to the underlying tier logic.

## Recommended next slice
Implement explicit raw/internal tier linkage in the governed verdict block, then verify the rendered block stays cool while the mapping remains visible and unambiguous.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane tightens render-to-logic traceability for future battle artifacts; it does not itself create a new gameplay artifact.
