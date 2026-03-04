# Statistical Evaluation Protocol v0

**Date:** 2026-03-04  
**Purpose:** Convert mechanism claims into falsifiable, reproducible evidence.

---

## 1) Primary Metrics

For rolling window `W` battles:

- `p2 = count(resultType=2)/settled`
- `p4 = count(resultType=4)/settled`
- `p7 = count(resultType=7)/settled`
- `pshort = count(settled && turn<=1)/settled`
- `median_turn_settle`
- `bank_delta_distribution`

These are the minimum health dashboard metrics.

---

## 2) Baseline + Delta

1. Snapshot baseline from current deployment (`baseline_t0`).
2. After each patch rollout, compute `delta = metric_new - baseline_t0`.
3. Report with battle range + timestamp + extraction script version.

No patch is considered successful without negative deltas for targeted bad outcomes.

---

## 3) Script vs Adaptive Tournament Slice

Maintain two controlled cohorts:
- scripted baseline cohort,
- adaptive LLM+tools cohort.

Track:
- settle result mix,
- survival turns,
- expected bank change.

Acceptance target:
- `E[U_adaptive] - E[U_script] > 0` robustly over repeated windows.

---

## 4) Confidence Discipline (Lightweight)

For each rate metric (`p2`, `p4`, `p7`, `pshort`):
- use Wilson interval or bootstrap CI,
- avoid over-claiming from tiny samples,
- if CI overlaps baseline strongly, mark as inconclusive.

---

## 5) Anti-Gaming Checks

Every metric report must include:
- `battleId` list,
- settle tx references,
- extraction command or script hash,
- explicit handling of missing/unknown resultType parse.

If parser reliability is uncertain, the report is invalid.

---

## 6) Artifact Layout

Recommended outputs:
- `memory/metrics/resulttype-baseline-YYYY-MM-DD.json`
- `memory/metrics/resulttype-window-YYYY-MM-DD-HHMM.json`
- `docs/model/metrics-notes-YYYY-MM-DD.md`

---

## 7) Decision Rule

A mechanism patch moves forward only if:
1. targeted bad-rate metrics improve,
2. no severe liveness regression,
3. adaptive-vs-script gap does not collapse,
4. evidence is reproducible.

Otherwise: rollback/tune/retest.
