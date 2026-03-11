# 113 — Meta-Reasoning Escalation Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/112-META-REASONING-ESCALATION-GATE-PLAN-2026-03-11.md`
- Red-team report: `docs/research/META-REASONING-ESCALATION-GATE-REDTEAM-2026-03-11.md`

## Goal
Turn the meta-reasoning escalation direction into a mergeable sequence of deterministic hardening slices that resist controller-gaming without collapsing liveness.

## Failure classes to target
1. **Controller gaming** — attackers farm the controller into repeated expensive deeper-verification paths.
2. **Over-eager fail-closed** — noisy or incomplete evidence trips shutdown behavior too easily.
3. **Threshold/provenance brittleness** — weak diagnostics manipulate control decisions because thresholds or confidence semantics are too naive.

## Constrained tasks

### Task 1 — Control-path debt + decision-trace support
**Why first:** if repeated escalation has no memory and no trace, attackers can turn salvageable uncertainty into a sustained resource-drain strategy.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact escalation diagnostic summary + existing actor/context debt
- output reasons:
  - `tactic-escalation-accept-cheap-path`
  - `tactic-escalation-request-deeper-verification`
  - `tactic-escalation-fail-closed`
- artifact must preserve triggering diagnostics, threshold inputs, and updated debt state
- artifact hash must be stable for identical inputs

**Acceptance criteria**
1. clean diagnostic bundle with low debt => `tactic-escalation-accept-cheap-path`
2. escalation-farming fixture deterministically increases debt and yields `tactic-escalation-request-deeper-verification`
3. artifact preserves triggering metrics + debt state with stable ordering
4. identical inputs produce identical artifact hash
5. `bun test` for the slice passes
6. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Fail-closed admissibility guard
**Why second:** fail-closed should protect against hostile risk, not turn ordinary ambiguity into self-inflicted denial of service.

**Scope**
- require stronger evidence for fail-closed than for routine mixed/weak cases
- proposed reasons remain:
  - `tactic-escalation-request-deeper-verification`
  - `tactic-escalation-fail-closed`

**Acceptance criteria**
1. benign incompleteness fixture does not trip fail-closed
2. contradiction/version-risk griefing fixture trips fail-closed only when stronger evidence threshold is met
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Confidence-weighted threshold policy
**Why third:** fixed thresholds without provenance weighting are easy to game from both directions.

**Scope**
- weight upstream diagnostics by provenance/confidence class
- distinguish strong contradiction/version-risk from weak/noisy ambiguity
- proposed reasons remain deterministic under weighted policy

**Acceptance criteria**
1. low-confidence diagnostics cannot outweigh high-confidence contradiction/version signals
2. threshold-hugging cheap-path forgery fixture is rejected or escalated
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No live deeper-verification wiring, no runtime rate limiting, no claim that controller gaming is solved.

## Narrative-quality target
This roadmap succeeds only if escalation behavior becomes more reviewable and harder to farm, without pretending every ambiguous case is hostile.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (control-path debt + decision-trace support), no runtime wiring in the same slice.
