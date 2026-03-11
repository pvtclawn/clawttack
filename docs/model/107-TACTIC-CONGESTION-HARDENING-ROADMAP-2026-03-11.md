# 107 — Tactic Congestion Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/106-TACTIC-CONGESTION-PRICE-OF-ANARCHY-GATE-PLAN-2026-03-11.md`
- Red-team report: `docs/research/TACTIC-CONGESTION-GATE-REDTEAM-2026-03-11.md`

## Goal
Turn the tactic-congestion direction into a mergeable sequence of deterministic hardening slices that resist metric gaming while keeping the first implementation small.

## Failure classes to target
1. **Label theater** — same tactic shape presented as different family labels.
2. **Fake novelty** — shallow paraphrase or wrapper-story churn passes as diversity.
3. **Payoff / feasibility laundering** — repeated tactics look justified through tiny gains or unproven alternative unavailability.

## Constrained tasks

### Task 1 — Tactic evidence derivation + uncertainty lock
**Why first:** if family identity is weak, every downstream congestion metric is built on sand.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: declared tactic labels + structured evidence tuple
- output reasons:
  - `tactic-evidence-pass`
  - `tactic-evidence-label-spoof-risk`
  - `tactic-evidence-ambiguous-family`
- artifact hash must be stable for identical evidence tuples

**Acceptance criteria**
1. spoofed self-label fixture fails with `tactic-evidence-label-spoof-risk`
2. ambiguous family fixture fails with `tactic-evidence-ambiguous-family`
3. clean aligned evidence fixture passes with `tactic-evidence-pass`
4. identical inputs produce identical artifact hash
5. `bun test` for the slice passes
6. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Strategy-shape repetition guard
**Why second:** lexical variety must not masquerade as strategic diversity.

**Scope**
- compare tactic intent / target mechanism / pressure pattern across a rolling window
- do not rely on text similarity alone
- proposed reasons:
  - `tactic-shape-distinct`
  - `tactic-shape-repetitive`
  - `tactic-shape-evidence-incomplete`

**Acceptance criteria**
1. shallow-paraphrase fixture is still classified as `tactic-shape-repetitive`
2. same-family but genuinely different pressure-shape fixture passes as `tactic-shape-distinct`
3. missing required shape evidence fails as `tactic-shape-evidence-incomplete`
4. identical windows produce identical artifact hash
5. `bun test` for the slice passes
6. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Payoff + feasibility justification guard
**Why third:** repeated tactics should only survive when both payoff and alternative scarcity are evidenced, not implied.

**Scope**
- require battle-level contribution evidence
- require explicit feasibility witness before excusing unused tactic families
- proposed reasons:
  - `tactic-justification-pass`
  - `tactic-payoff-insufficient`
  - `tactic-feasibility-unproven`
  - `tactic-selfish-equilibrium-detected`

**Acceptance criteria**
1. tiny incidental gain fixture fails with `tactic-payoff-insufficient`
2. narrow feasible-action-state fixture avoids false punishment only when feasibility witness is present
3. absent alternative-feasibility evidence fails with `tactic-feasibility-unproven`
4. dominant repeated tactic without strong payoff justification fails with `tactic-selfish-equilibrium-detected`
5. identical windows produce identical artifact hash
6. `bun test` for the slice passes
7. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No production scoring wiring, no runtime penalties, no UI coupling.

## Narrative-quality target
This roadmap is successful only if it makes boring-equilibrium risk more legible without rewarding performative novelty.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (tactic evidence derivation + uncertainty lock evaluator + fixtures), no runtime wiring in the same slice.
