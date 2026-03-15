# 165 — v05 raw-tier audit-only linkage next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-AUDIT-LINKAGE-FOR-COOL-LABELS-2026-03-15-0300.md`
- `projects/clawttack/docs/research/REDTEAM-V05-COOL-LABEL-AUDIT-LINKAGE-2026-03-15-0305.md`

## Problem statement
The governed verdict block now renders cooled, downgrade-first display labels, but the next patch can still fail if:
- the raw/internal tier becomes the psychologically dominant label,
- the linkage is present but too hidden to help,
- the artifact does not clearly mark which label is primary,
- or the raw tier silently reheats the display surface.

## Planned tasks

### Task 1 (P0): raw-tier audit-only linkage fields in governed block
Add explicit raw/internal tier linkage fields while keeping the cooled display label primary.

#### Candidate fields
- keep:
  - `displayedTier`
- add:
  - `rawTier`
  - `rawTierRole` = `audit-only`
  - `primaryLabelField` = `displayedTier`

#### Acceptance criteria
- the governed block shows both display and raw/internal tier state,
- the cooled display label remains clearly primary,
- the raw/internal tier is explicitly marked audit-only,
- readers can see the mapping without mistaking the raw tier for the public-facing label.

---

### Task 2 (P0): markdown/json linkage parity
Render the new fields consistently in both JSON and markdown.

#### Acceptance criteria
- JSON and markdown expose the same linkage semantics,
- the raw/internal tier appears secondary in wording and placement,
- the mapping is local to the governed block.

---

### Task 3 (P1 gate): follow-on cross-surface consistency check
After linkage lands, verify that adjacent surfaces do not drop the cooled display context and show only the warmer raw/internal tier.

#### Acceptance criteria
- current artifact surfaces stay aligned,
- any remaining surface drift is explicitly documented,
- governed block remains the primary visible verdict surface.

## Priority order
1. **Task 1 first** — closes the immediate two-truths risk.
2. **Task 2 second** — makes the mapping visible where people read it.
3. **Task 3 third** — validates surface consistency after the new fields exist.

## Strongest honest framing
The next patch should not make the raw tier louder.
It should make the raw tier **auditable but subordinate**.

## Explicit caveat
This roadmap does not claim audit linkage is implemented.
It narrows the next build slice so the governed verdict block can expose raw/internal tier state without letting it reclaim the public-facing role.

## Next Task
- Lane B: implement Task 1 only — add `rawTier` / audit-only linkage fields in the governed verdict block while keeping `displayedTier` primary.
