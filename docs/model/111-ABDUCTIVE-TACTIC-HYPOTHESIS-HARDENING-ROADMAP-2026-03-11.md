# 111 — Abductive Tactic-Hypothesis Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/110-ABDUCTIVE-TACTIC-HYPOTHESIS-GATE-PLAN-2026-03-11.md`
- Red-team report: `docs/research/ABDUCTIVE-TACTIC-HYPOTHESIS-GATE-REDTEAM-2026-03-11.md`

## Goal
Turn the abductive tactic-hypothesis direction into a mergeable sequence of deterministic hardening slices that resist explanation-ranking abuse without pretending inferred intent is directly observable.

## Failure classes to target
1. **Hypothesis theater** — decorative support padding distorts the candidate ranking without improving explanatory quality.
2. **Contradiction laundering** — strong conflicting evidence gets averaged away instead of decisively lowering confidence.
3. **No-fit / threshold gaming** — hybrid or weakly explained attacks force brittle winners or ambiguity outcomes that can be strategically farmed.

## Constrained tasks

### Task 1 — Density + contradiction-aware abductive scorer
**Why first:** if support density and contradiction floors are weak, every later threshold or no-fit rule is built on manipulated candidate rankings.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: pre-derived candidate hypothesis set with support/contradiction values per family
- output reasons:
  - `tactic-hypothesis-pass`
  - `tactic-hypothesis-ambiguous`
  - `tactic-hypothesis-contradicted`
- artifact hash must be stable for identical candidate sets

**Acceptance criteria**
1. strong clean single-family candidate set passes with `tactic-hypothesis-pass`
2. hypothesis-padding fixture degrades verdict or margin into `tactic-hypothesis-ambiguous`
3. contradiction-heavy fixture fails with `tactic-hypothesis-contradicted`
4. identical candidate sets produce identical artifact hash
5. `bun test` for the slice passes
6. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Threshold-gaming guard
**Why second:** a single naive margin threshold is easy to target once attackers learn the scoring surface.

**Scope**
- distinguish clean close-calls from threshold-hugging ambiguity farming / false-certainty nudging
- proposed reasons:
  - `tactic-hypothesis-ambiguous`
  - `tactic-hypothesis-threshold-gamed`
  - `tactic-hypothesis-pass`

**Acceptance criteria**
1. threshold-hugging ambiguity-farming fixture is distinguishable from a genuinely close explanatory tie
2. false-certainty nudging fixture is rejected or downgraded to `tactic-hypothesis-threshold-gamed`
3. identical candidate sets produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — No-fit fallback + explanation trace support
**Why third:** the system must be able to say “none of these are good enough” and preserve why, instead of forcing a misleading winner.

**Scope**
- add no-fit / weak-support outcome and stable top-candidate explanation trace
- proposed reasons:
  - `tactic-hypothesis-weak-support`
  - `tactic-hypothesis-pass`
- artifact should preserve ordered top candidates with support / contradiction / margin data

**Acceptance criteria**
1. hybrid or no-good-fit fixture fails with `tactic-hypothesis-weak-support`
2. explanation trace preserves stable candidate ordering for identical inputs
3. identical candidate sets produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No runtime wiring, no scoring changes, no claim that live narrative inference is solved.

## Narrative-quality target
This roadmap succeeds only if it makes tactic explanations more honest about support and contradiction, rather than more cosmetically confident.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (density + contradiction-aware abductive scorer + fixtures), no runtime wiring in the same slice.
