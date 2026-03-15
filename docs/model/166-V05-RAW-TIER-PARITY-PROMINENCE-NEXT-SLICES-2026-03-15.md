# 166 — v05 raw-tier parity prominence next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-RAW-TIER-PARITY-2026-03-15-0335.md`
- `projects/clawttack/docs/research/REDTEAM-V05-RAW-TIER-PARITY-2026-03-15-0340.md`

## Problem statement
Raw-tier parity work is directionally correct, but it can still fail if parity is treated as a schema-only concern rather than a visible-semantics concern.

Current risks:
- both surfaces can expose the same fields while still implying different authority,
- ordering can silently make `rawTier` feel more real than `displayedTier`,
- markdown can dominate perception even when JSON is formally correct,
- field naming can subtly reassign authority,
- and local JSON+markdown parity can be overclaimed as broader system consistency.

## Planned tasks

### Task 1 (P0): verify prominence/order parity across current artifact surfaces
Treat parity as a semantic/render concern, not merely a structural one.

#### What to verify
- `displayedTier` appears first and explicitly primary in both JSON and markdown governed-block outputs,
- `rawTier` remains visibly secondary / audit-only in both surfaces,
- field order and wording do not invert the relationship on either surface.

#### Acceptance criteria
- parity check covers order/prominence, not just field existence,
- markdown is treated as a first-class target,
- no current artifact surface makes `rawTier` feel like the public-facing verdict.

---

### Task 2 (P0): authority-stable field naming
Keep names aligned so one surface does not quietly make the raw/internal tier sound more authoritative than the display label.

#### Acceptance criteria
- current JSON and markdown use stable, explicit naming,
- `displayedTier` is clearly the public-facing label,
- `rawTier` is clearly audit-only.

---

### Task 3 (P1 gate): explicit parity scope statement
Document that the parity claim is limited to current JSON+markdown artifact surfaces.

#### Acceptance criteria
- artifacts/docs do not imply broader UI/log parity,
- remaining broader-surface consistency is explicitly left as follow-on work.

## Priority order
1. **Task 1 first** — biggest remaining semantic drift risk.
2. **Task 2 second** — locks naming authority in place.
3. **Task 3 third** — prevents overclaiming local parity as global consistency.

## Strongest honest framing
The next patch should not merely say the surfaces match.
It should show they preserve the **same primary/secondary relationship** when read by humans.

## Explicit caveat
This roadmap does not claim raw-tier parity is complete.
It narrows the next build slice so parity is verified as visible semantics across current artifact surfaces before any broader consistency claims are made.

## Next Task
- Lane B: implement Task 1 only — add a current-surface parity check that verifies `displayedTier` remains first/primary and `rawTier` remains secondary/audit-only across JSON and markdown governed-block outputs.
