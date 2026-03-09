# 031 — Hint-Surface Sensitivity Hardening Roadmap (2026-03-09)

Input artifact: `memory/challenges/2026-03-09--hint-surface-sensitivity-gate-red-team.md`

## Goal
Convert hint-surface sensitivity red-team findings into merge-sized tasks with deterministic acceptance gates.

---

## Task 1 (P0): Tier anti-leakage discipline + holdout hint rotation

### Scope
- Obfuscate hidden tier identifiers in developer-facing outputs.
- Rotate holdout hint templates and seed schedules per evaluation window.
- Separate internal tier mapping from visible diagnostics.

### Acceptance criteria
1. Hidden-tier metadata is absent from developer-visible artifacts.
2. Holdout hint corpus version differs across windows by policy.
3. Leakage audit checklist passes before publishing gate verdicts.

---

## Task 2 (P0): Slope + absolute-floor co-gating

### Scope
- Keep sensitivity-slope checks, but require per-tier absolute metric floors.
- Add explicit non-regression floor for tier-0 baseline.
- Emit metric-wise fail reasons (not composite-only).

### Acceptance criteria
1. Runs cannot pass on slope-only when absolute tier floors fail.
2. Tier-0 regression beyond threshold fails deterministically.
3. Verdict artifact includes slope + per-tier floor outcomes per metric.

---

## Task 3 (P1): Critical branch-flip + tool-mode interaction gates

### Scope
- Mark critical safe→unsafe branch flips as hard-fail events.
- Stratify every hint tier by tool mode (`ON`/`OFF`).
- Add interaction gate for `hintTier × toolMode` unsafe spikes.

### Acceptance criteria
1. Any critical safe→unsafe branch flip produces deterministic hard fail.
2. Tool-enabled tier-2 unsafe breaches cannot pass aggregate gate.
3. Verdict artifact includes branch-flip table + interaction summary.

---

## Next Task (single)
Implement Task 2 first in simulation-only helper (slope + absolute floors + tier-0 non-regression checks), with no production behavior changes in the same PR.
