# 019 — Dual-Clock Timeout Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--dual-clock-timeout-evidence-red-team.md`

## Goal
Translate dual-clock timeout red-team findings into merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Suspect-state anti-farming controls

### Scope
- Add per-agent suspect-cycle counter in simulation timeout state machine.
- Introduce bounded suspect lifetime with deterministic fallback.
- Escalate repeated suspect cycles via debt score that increases confirm likelihood.

### Acceptance criteria
1. Adversarial suspect-loop fixtures cannot keep battle in suspect state indefinitely.
2. Suspect lifetime bound always resolves to `confirm` or `clear` within configured max window.
3. Simulation shows non-positive EV for suspect-state farming strategy versus baseline.

---

## Task 2 (P0): Progress-coupled heartbeat evidence semantics

### Scope
- Classify heartbeat evidence as strong only when accompanied by sequence/progress proof.
- Treat heartbeat-without-progress as weak signal that cannot block confirmation indefinitely.
- Persist evidence class in replay trace for auditability.

### Acceptance criteria
1. Heartbeat-only/no-progress fixtures cannot prevent timeout confirmation past bound.
2. Evidence trace logs include heartbeat class and associated progress proof fields.
3. Replay over fixed traces yields deterministic outcomes.

---

## Task 3 (P1): Corroboration weighting + conflict precedence

### Scope
- Replace flat 2-of-3 corroboration with manipulability-aware weighting.
- Define deterministic precedence rules when logical and physical signals conflict.
- Version precedence policy for replay compatibility.

### Acceptance criteria
1. Parameter sweeps identify no brittle threshold region exploitable by single-signal gaming.
2. Conflicting evidence fixtures always produce identical deterministic verdicts.
3. Precedence version is emitted in decision artifact and replayed losslessly.

---

## Next Task (single)
Implement **Task 1 only** in a simulation module (no production settlement changes), with fixture tests for suspect-loop farming and bounded resolution invariants.
