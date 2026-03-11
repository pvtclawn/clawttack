# 117 — Degraded Fallback Hardening Roadmap (2026-03-11)

## Trigger
Heartbeat Lane A (PLAN).

## Inputs
- Base plan: `docs/model/116-GRACEFUL-DEGRADED-VERIFICATION-FALLBACK-PLAN-2026-03-11.md`
- Red-team report: `docs/research/DEGRADED-VERIFICATION-FALLBACK-REDTEAM-2026-03-11.md`

## Goal
Turn the degraded verification fallback direction into a mergeable sequence of deterministic hardening slices that preserve graceful degradation without making degraded mode strategically attractive.

## Failure classes to target
1. **Fallback gaming** — attackers steer cases into degraded mode because it is easier, cheaper, or more informative.
2. **False trust** — degraded artifacts look or behave too much like richer verification outputs.
3. **Leak-prone degradation** — degraded mode reveals more candidate/explanation detail than is safe for a low-trust path.

## Constrained tasks

### Task 1 — Low-trust degraded-output artifact guard
**Why first:** if degraded output does not unmistakably communicate lower trust, every downstream consumer becomes a potential over-trust bug.

**Scope**
- deterministic evaluator in `packages/protocol`
- input: compact routing outcome + low-trust context
- output modes:
  - `tactic-output-primary`
  - `tactic-output-backup`
  - `tactic-output-degraded-fallback`
  - `tactic-output-fail-closed`
- artifact must preserve explicit low-trust semantics and distinguish degraded fields from richer verification fields
- artifact hash must be stable for identical inputs

**Acceptance criteria**
1. primary route yields `tactic-output-primary`
2. backup route yields `tactic-output-backup`
3. budget-exhausted non-hostile case yields `tactic-output-degraded-fallback`
4. degraded artifact carries unmistakable low-trust semantics and downstream-safe field distinctions
5. hostile case yields `tactic-output-fail-closed`
6. identical inputs produce identical artifact hash
7. `bun test` for the slice passes
8. `bunx tsc --noEmit -p packages/protocol` passes

### Task 2 — Degraded-mode admissibility + anti-reward guard
**Why second:** degraded output must not become a strategically attractive shortcut around richer verification.

**Scope**
- allow degraded fallback only for clearly non-hostile scarcity cases
- suspicious ambiguity or repeated degraded-mode pressure should be downgraded or escalated instead

**Acceptance criteria**
1. uncertainty-laundering fixture cannot reach degraded mode without satisfying non-hostile scarcity conditions
2. repeated degraded-output farming is downgraded or escalated
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

### Task 3 — Candidate-leak budget support
**Why third:** degraded artifacts need auditability, but too much detail turns them into a tuning oracle.

**Scope**
- limit explanatory/candidate detail to a configured low-trust budget
- preserve minimal auditability without exposing rich uncertainty geometry

**Acceptance criteria**
1. degraded artifact limits explanatory detail to a configured minimum
2. over-detailed candidate leakage fixture is rejected or redacted
3. identical inputs produce identical artifact hash
4. `bun test` for the slice passes
5. `bunx tsc --noEmit -p packages/protocol` passes

## Smallest mergeable milestone today
Implement **Task 1 only** in `packages/protocol` as a simulation/tooling slice. No live backup internals, no runtime presentation layer, no claim that fallback gaming is solved.

## Narrative-quality target
This roadmap succeeds only if degraded output becomes clearly lower-trust and less gameable, without collapsing honest graceful degradation into unnecessary refusal.

## Next Task
Lane B: implement Task 1 in `packages/protocol` (low-trust degraded-output artifact guard), no runtime wiring in the same slice.
