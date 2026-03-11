# 115 — Primary/Backup Routing Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/114-PRIMARY-BACKUP-VERIFICATION-ROUTING-PLAN-2026-03-11.md`
- Red-team report: `docs/research/PRIMARY-BACKUP-VERIFICATION-ROUTING-REDTEAM-2026-03-11.md`

## Goal
Turn the primary/backup verification routing direction into a mergeable sequence of deterministic hardening slices that resist routing gaming without collapsing useful fallback behavior.

## Failure classes to target
1. **Budget farming** — attackers drain backup capacity by keeping cases barely salvageable.
2. **Backup attractiveness** — ambiguous cases become strategically rewarded with a richer route.
3. **Routing brittleness** — budget scarcity and hostile-risk signals collapse together into unnecessary fail-closed behavior.

## Constrained tasks

### Task 1 — Budget-partition + route-trace support
**Why first:** if backup capacity is coarse and route decisions are opaque, routing attacks become invisible and one source can starve unrelated cases.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact escalation summary + actor/context budget/debt state
- output reasons:
  - `tactic-routing-primary-path`
  - `tactic-routing-backup-path`
  - `tactic-routing-budget-exhausted`
  - `tactic-routing-fail-closed`
- artifact must preserve route rationale, per-actor/context budget state, and debt context
- artifact hash must be stable for identical inputs

**Acceptance criteria**
1. clean bundle with healthy per-context budget => `tactic-routing-primary-path`
2. mixed-but-salvageable bundle with healthy backup budget => `tactic-routing-backup-path`
3. salvageable bundle with exhausted backup budget => `tactic-routing-budget-exhausted`
4. artifact preserves route rationale + budget/debt trace with stable ordering
5. identical inputs produce identical artifact hash
6. `bun test` for the slice passes
7. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Backup-path anti-reward guard
**Why second:** if the backup route is systematically more attractive, attackers will learn to aim for it deliberately.

**Scope**
- distinguish honest hard cases from strategically ambiguous cases seeking richer processing
- proposed deterministic outcomes remain routing reasons, but ambiguity farming should be downgraded or rate-limited

**Acceptance criteria**
1. strategically ambiguous case does not receive a systematically better route than a clean case
2. backup-path attractiveness exploitation fixture is downgraded or rate-limited
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Routing fail-closed admissibility guard
**Why third:** budget exhaustion and hostile contradiction/version-risk should not be conflated.

**Scope**
- preserve explicit difference between non-hostile scarcity and hostile routing risk
- proposed outcomes:
  - `tactic-routing-budget-exhausted`
  - `tactic-routing-fail-closed`

**Acceptance criteria**
1. non-hostile budget exhaustion yields `tactic-routing-budget-exhausted`
2. hostile contradiction/version-risk + budget stress fixture yields `tactic-routing-fail-closed` only with stronger evidence
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No live backup verification internals, no runtime quota enforcement, no claim that routing gaming is solved.

## Narrative-quality target
This roadmap succeeds only if routing becomes more reviewable and fair under uncertainty, without turning backup verification into a prize for ambiguity.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (budget-partition + route-trace support), no runtime wiring in the same slice.
