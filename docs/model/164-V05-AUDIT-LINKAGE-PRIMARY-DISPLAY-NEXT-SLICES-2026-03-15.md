# 164 — v05 audit linkage with primary display next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-AUDIT-LINKAGE-FOR-COOL-LABELS-2026-03-15-0300.md`
- `projects/clawttack/docs/research/REDTEAM-V05-COOL-LABEL-AUDIT-LINKAGE-2026-03-15-0305.md`

## Problem statement
The cooled governed-block labels reduced visible prestige leakage, but the next patch can still fail if:
- the raw/internal tier becomes the psychologically dominant label,
- the linkage is technically present but practically hidden,
- the governed block does not make clear which label is primary,
- or different surfaces later show different truths.

## Planned tasks

### Task 1 (P0): primary display + audit-only raw tier inside governed block
Add explicit audit-linkage fields in the governed verdict block while keeping the cooled display label visibly primary.

#### Candidate fields
- keep:
  - `displayedTier`
- add:
  - `rawTier`
  - `rawTierRole` = `audit-only`
  - `primaryLabelField` = `displayedTier`

#### Acceptance criteria
- cooled display label remains the primary human-facing label,
- raw/internal tier is visible in the same governed block,
- raw/internal tier is explicitly marked audit-only rather than co-equal,
- readers can see the mapping without the raw tier reheating the visible display.

---

### Task 2 (P0): markdown/json audit-linkage rendering parity
Render the linkage consistently in both JSON and markdown so the mapping is visible across the current artifact surfaces.

#### Acceptance criteria
- markdown governed block shows both cooled display label and raw/internal tier linkage,
- JSON artifact shows the same fields with the same semantics,
- the raw tier is clearly secondary in wording and placement.

---

### Task 3 (P1 gate): follow-on cross-surface consistency check
After linkage lands, verify that neighboring render surfaces do not quietly reintroduce only the warmer raw tier.

#### Acceptance criteria
- governed block remains the primary visible surface,
- adjacent artifact surfaces do not contradict the governed block,
- any remaining surface drift is documented explicitly as follow-on work.

## Priority order
1. **Task 1 first** — closes the immediate two-truths risk.
2. **Task 2 second** — ensures the mapping is visible where people actually read it.
3. **Task 3 third** — validates current-surface consistency after the new fields exist.

## Strongest honest framing
The next patch should not make the raw/internal tier louder.
It should make the cooled display label **primary and auditable at the same time**.

## Explicit caveat
This roadmap does not claim audit linkage is implemented.
It narrows the next build slice so the governed verdict block can expose raw/internal tier state without undoing the cooler public-facing label.

## Next Task
- Lane B: implement Task 1 only — add `rawTier`/audit-only linkage fields in the governed verdict block while keeping `displayedTier` primary.
