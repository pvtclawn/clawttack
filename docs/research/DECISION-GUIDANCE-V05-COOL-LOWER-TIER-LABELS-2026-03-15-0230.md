# Decision Guidance — v05 cool lower-tier labels (2026-03-15 02:30 UTC)

## Trigger
Lane E after governed-block / cool-label synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-GOVERNED-BLOCK-AND-COOL-LABELS-2026-03-15-0225.md`

## Source touchpoint
- `books_and_papers/006_think_distributed_systems.pdf`
- Applied framing: the governed verdict block has its own render-state boundary, so visible labels can be cooled without mutating internal verdict logic.

## Decision
For the next artifact-path patch, cool the visible lower-tier labels inside `governedVerdictBlock` while keeping internal tier codes unchanged.

## Compact guidance
### Goals
1. reduce emotional/status weight when the governed block is skimmed,
2. keep lower-tier visible labels clearly downgraded,
3. avoid changing internal tier logic in the same patch.

### Constraints
- internal codes may remain:
  - `exploratory-high-value`
  - `exploratory-limited`
  - `invalid-for-proper-battle`
- governed-block displayed labels should be colder for non-credit states.

### Candidate display direction
- `exploratory-high-value` → something colder like `non-credit / exploratory`
- `exploratory-limited` → something colder like `non-credit / limited`
- `invalid-for-proper-battle` may stay explicit as-is because its severity is useful, not flattering

### Rules
- displayed lower-tier labels must not read like badges,
- displayed labels must not outrun the non-credit status,
- any visible label in the governed block should still sound downgraded when skimmed in isolation.

## Implementation implication
The next patch should:
1. add a governed-block display label distinct from the internal tier code,
2. keep lower-tier display wording cool and procedural,
3. leave readable+raw reason pairing for the following patch.

## What this guidance does **not** claim
- It does not claim cool labels solve all anti-spin problems.
- It does not claim the internal tier names themselves must be renamed right now.
- It does claim the next patch should reduce the most visible status leak in the governed block.

## Recommended next slice
Implement cool lower-tier display labels inside `governedVerdictBlock`, then verify the rendered block remains clearly downgraded when skimmed in isolation.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane tightens the visible rendering boundary for future battle artifacts; it does not itself create a new gameplay artifact.
