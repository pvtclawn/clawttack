# 159 — v05 proper-battle rubric observable checks next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-PROPER-BATTLE-RUBRIC-APPLICATION-2026-03-15-0030.md`
- `projects/clawttack/docs/research/REDTEAM-V05-PROPER-BATTLE-RUBRIC-2026-03-15-0035.md`

## Problem statement
The current proper-battle rubric is directionally correct but still too soft in the exact places where false confidence can sneak in:
- legibility/authenticity remain partly subjective,
- source-of-move labels can be over-read as authorship proof,
- terminality can be treated as a prestige shortcut,
- and human summary prose can outrun the structured artifact verdict.

## Planned tasks

### Task 1 (P0): observable transcript-quality checks in artifact path
Replace soft rubric language like “legible/authentic enough” with narrower observable checks that can be surfaced as explicit fields/reasons.

#### Candidate checks
- `constraintVisible`
  - no visible seed/poison violation in the artifacted turn text path
- `repetitionRisk`
  - repeated filler / canned boilerplate / obvious template dominance
- `sceneCoherenceHint`
  - text contains a coherent scene/action rather than disconnected fragments
- `fallbackMasqueradeRisk`
  - artifact-level warning when transcript shape looks too close to deterministic fallback/template behavior

#### Acceptance criteria
- the artifact path emits narrower transcript-quality signals instead of one hand-wavy legibility bucket,
- a weak transcript can fail for explicit reasons,
- terminality alone cannot override transcript-quality failures.

---

### Task 2 (P0): explicit verdict tiers derived from artifact reasons
Introduce a small verdict ladder so evidence is not forced into a binary “proper or worthless” framing.

#### Proposed tiers
- `proper-battle`
- `exploratory-high-value`
- `exploratory-limited`
- `invalid-for-proper-battle`

#### Acceptance criteria
- final operator-facing verdict text is derived from explicit artifact reasons,
- strong non-terminal evidence can remain visible without being overclaimed,
- summary prose cannot silently outrun the structured classification.

---

### Task 3 (P1 gate): narrow source-of-move caveat language in artifact output
Keep source-of-move truth explicit while preventing overclaim language that sounds like full authorship proof.

#### Acceptance criteria
- artifact output distinguishes:
  - explicit source-of-move labeling,
  - from stronger autonomy/authorship proof claims,
- agent-vs-agent or agent-vs-script wording stays caveated when hidden-helper certainty is unavailable.

## Priority order
1. **Task 1 first** — smallest change that directly reduces subjective drift.
2. **Task 2 second** — prevents binary overclaiming and prose drift.
3. **Task 3 third** — improves wording discipline once the observable checks exist.

## Strongest honest framing
The next patch should not try to prove perfect authenticity.
It should make the artifact path **harder to flatter** by replacing soft judgment with observable checks and structured verdict tiers.

## Explicit caveat
This roadmap does not claim the proper-battle rubric is finished.
It narrows the next implementation so the next counted run will be judged by visible signals rather than operator enthusiasm.

## Next Task
- Lane B: implement Task 1 only — add observable transcript-quality checks and explicit failure reasons to the artifact path before any rubric-based counted run.
