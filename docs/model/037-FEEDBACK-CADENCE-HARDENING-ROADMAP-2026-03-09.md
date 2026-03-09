# 037 — Feedback Cadence Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--feedback-cadence-budget-gate-red-team.md`

## Goal
Convert feedback-cadence gate red-team findings into merge-sized tasks with deterministic acceptance criteria.

---

## Task 1 (P0): Anti-window-gaming velocity model

### Scope
- Add overlapping rolling windows in addition to fixed windows.
- Track burstiness/contiguous-change density.
- Fail cadence when multi-window aggregate risk exceeds cap even if single windows pass.

### Acceptance criteria
1. Burst-splitting fixtures cannot evade hard fail by distributing changes across adjacent windows.
2. Rolling-window and fixed-window verdicts are both emitted in artifact.
3. Aggregate-risk breach yields deterministic `cadence-budget-exceeded` reason.

---

## Task 2 (P0): Multi-signal velocity integrity + warning debt

### Scope
- Compute velocity from multiple signals (change count, touched files, dependency-edge delta, criticality).
- Fail closed when required velocity signals are missing (`velocity-signal-incomplete`).
- Add warning debt accumulation across consecutive near-threshold windows.

### Acceptance criteria
1. Missing velocity telemetry cannot produce pass verdicts.
2. Repeated near-threshold windows escalate deterministically from warning to fail.
3. Velocity artifact includes per-signal contributions and debt trend fields.

---

## Task 3 (P1): Criticality integrity + cadence-quality joint gate

### Scope
- Add independent criticality inference and override audit trail.
- Couple cadence pass with verification-quality floor (fixture depth/coverage).
- Emit joint verdict reason when cadence passes but quality fails.

### Acceptance criteria
1. Criticality override anomalies are flagged with deterministic reason codes.
2. Fast-but-shallow verification cannot pass combined gate.
3. Joint verdict artifact includes both timing and quality dimensions.

---

## Next Task (single)
Implement Task 1 first as a simulation/tooling helper (rolling-window + burstiness anti-splitting logic), with no production runtime behavior changes in the same PR.
