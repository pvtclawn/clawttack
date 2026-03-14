# REDTEAM — V05 strict-mode + contamination counters

- **Date:** 2026-03-14 11:14 (Europe/London)
- **Scope:** `packages/sdk/scripts/summarize-v05-batches.py`
- **Lane:** F (CHALLENGE)

## Why this review
Task under review: implement strict-mode guardrails and contamination counters without breaking reliability or interpretability of aggregate summaries.

## Weaknesses identified

1. **Strict-mode output-boundary hazard**
   - Risk: non-zero exit happens before diagnostics are persisted.
   - Consequence: CI/operator only sees “failed” without actionable root cause.
   - Mitigation: write aggregate JSON diagnostics first, then evaluate strict exit.

2. **Contamination counter conflation**
   - Risk: one umbrella counter blends distinct failure classes.
   - Consequence: remediation path becomes ambiguous; trend metrics become noisy.
   - Mitigation: keep counters orthogonal (label hygiene, max-turn comparability, freshness/source integrity).

3. **False-positive induced disablement**
   - Risk: strict mode blocks runs for low-impact anomalies.
   - Consequence: operators bypass strict mode, eliminating safety value.
   - Mitigation: classify warnings by severity; strict should trigger only on defined hard violations.

4. **Stale artifact contamination**
   - Risk: guardrail checks accidentally ingest prior summary outputs as truth.
   - Consequence: repeated failures unrelated to current run inputs.
   - Mitigation: compute violations from current selected batch logs/checkpoints only.

5. **JSON/Markdown divergence**
   - Risk: warnings shown in markdown but not represented in machine-readable JSON.
   - Consequence: automation and humans disagree on run health.
   - Mitigation: JSON is canonical; markdown mirrors JSON fields.

## Required safeguards before coding complete
- Add JSON contract fields:
  - `strictMode`
  - `strictViolationCount`
  - `labelContaminationCount`
  - `maxTurnsContaminationCount`
  - `warnings[]`
- Define strict violation policy explicitly in code comments/docs.
- Preserve deterministic ordering of warnings/counters for diff stability.

## Acceptance criteria for next build slice
1. Aggregate JSON always written with diagnostics even when strict mode fails.
2. `strictViolationCount` deterministically equals count of hard violations.
3. Process exits non-zero iff `strictMode=true && strictViolationCount>0`.
4. Markdown guardrail section mirrors JSON values exactly.

## Caveat
This red-team lane narrows implementation risk but does not change summarizer behavior yet.
