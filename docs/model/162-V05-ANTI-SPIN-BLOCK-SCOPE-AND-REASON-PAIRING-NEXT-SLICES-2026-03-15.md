# 162 — v05 anti-spin block scope and reason pairing next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-ANTI-SPIN-SUMMARY-BLOCKS-2026-03-15-0200.md`
- `projects/clawttack/docs/research/REDTEAM-V05-ANTI-SPIN-SUMMARY-BLOCKS-2026-03-15-0205.md`

## Problem statement
The anti-spin summary-block direction is correct, but it can still fail if:
- the governed block boundary is only conceptual,
- lower-tier labels remain emotionally warm,
- readable reasons soften the severity of raw reason codes,
- or hype simply migrates one line outside the formally constrained sentence.

## Planned tasks

### Task 1 (P0): implementation-clear verdict block scope
Define the exact fields/lines that belong to the governed verdict block so anti-spin rules apply consistently across renderers.

#### Candidate governed block contents
- displayed tier label (or subdued lower-tier equivalent)
- immediate verdict sentence
- adjacent top caveat / top invalid trigger
- no additional warming line inside the block

#### Acceptance criteria
- the governed block is explicit in artifact output structure,
- maintainers can see where anti-spin rules begin and end,
- softening prose cannot accidentally live inside the governed region.

---

### Task 2 (P0): cool lower-tier displayed labels
Reduce emotional weight of lower-tier visible labels in the verdict area.

#### Candidate direction
- keep internal tier codes as-is for logic,
- but render colder displayed labels or pair them with explicit non-credit wording every time they appear prominently.

#### Acceptance criteria
- lower-tier labels do not feel promotional when skimmed,
- visible label language does not outrun the non-credit verdict sentence,
- quoted fragments from the verdict area remain clearly downgraded.

---

### Task 3 (P1 gate): readable + raw reason pairing
Expose a readable reason form without losing the raw structured reason code that justified the verdict.

#### Acceptance criteria
- artifact shows readable reason plus raw reason code together where relevant,
- readable reason stays severity-aligned with the raw code,
- auditors can trace rendered wording back to raw structured state.

## Priority order
1. **Task 1 first** — boundary clarity is the prerequisite for anti-spin enforcement.
2. **Task 2 second** — cools the most visible leak.
3. **Task 3 third** — improves auditability once the governed block exists.

## Strongest honest framing
The next patch should not make lower-tier verdicts friendlier.
It should make the governed verdict area **harder to cosmetically warm up**.

## Explicit caveat
This roadmap does not claim anti-spin rendering is implemented.
It narrows the next build slice so the verdict block becomes implementation-clear before softer wording has more places to hide.

## Next Task
- Lane B: implement Task 1 only — encode the exact governed verdict block scope in the artifact path before cooling lower-tier labels or adding readable+raw reason pairing.
