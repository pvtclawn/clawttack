# 163 — v05 cool labels + audit linkage next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-COOL-LOWER-TIER-LABELS-2026-03-15-0230.md`
- `projects/clawttack/docs/research/REDTEAM-V05-COOL-LOWER-TIER-LABELS-2026-03-15-0235.md`

## Problem statement
Cooling lower-tier display labels is the right next move, but it can still fail if:
- displayed labels and internal tier codes become two competing truths,
- cooled labels become too vague,
- the first visible word still carries warmth,
- the ladder becomes stylistically uneven,
- or warmer phrasing leaks back through neighboring surfaces.

## Planned tasks

### Task 1 (P0): downgrade-first governed-block display labels
Add governed-block display labels that lead with the downgrade and reduce prestige leakage when skimmed.

#### Candidate direction
- keep internal tier codes unchanged for logic,
- but render colder labels in the governed block such as:
  - `non-credit / exploratory`
  - `non-credit / limited`
  - keep `invalid-for-proper-battle` explicit if needed for severity.

#### Acceptance criteria
- displayed lower-tier labels lead with downgrade terms,
- labels remain distinct enough to separate exploratory vs limited,
- labels do not read like badges or near-success markers.

---

### Task 2 (P0): auditable linkage from displayed label to internal tier
Expose a visible path from cooled display label back to the raw/internal tier state so the system does not develop a public truth and a private truth.

#### Acceptance criteria
- governed block or adjacent artifact fields show both:
  - cooled display label,
  - internal/raw tier code,
- maintainers can trace rendered wording back to logic state,
- readers are not forced to guess whether display wording is hiding stronger semantics.

---

### Task 3 (P1 gate): cross-surface label consistency check
Verify that cooled labels do not diverge across governed block vs nearby render surfaces.

#### Acceptance criteria
- governed block and adjacent artifact surfaces remain consistent,
- warmer internal phrasing does not leak back into the most visible rendered region,
- invalid-tier severity remains explicit without making the ladder feel arbitrary.

## Priority order
1. **Task 1 first** — most visible prestige leak.
2. **Task 2 second** — prevents split-brain semantics.
3. **Task 3 third** — validates consistency after rendering changes land.

## Strongest honest framing
The next patch should not merely make lower-tier labels sound cooler.
It should make them **cool, distinct, and auditable**.

## Explicit caveat
This roadmap does not claim cool labels are implemented.
It narrows the next build slice so the governed verdict block can cool visible lower-tier labels without turning into a vague second truth.

## Next Task
- Lane B: implement Task 1 only — add downgrade-first governed-block display labels before adding explicit audit linkage fields.
