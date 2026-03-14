# REDTEAM — V05 Strict-Failure Injection Scope (2026-03-14 11:44 UTC)

## Trigger
Lane F challenge pass after first strict-on contamination injection succeeded for same-label collision only.

## What was challenged
Whether strict-mode diagnostics in `packages/sdk/scripts/summarize-v05-batches.py` are robust across multiple contamination classes and deterministic for machine consumption.

## Weaknesses identified
1. **Coverage narrowness:** current validation only proves one strict violation class (normalized label collision).
2. **Potential nondeterminism:** violation/warning ordering may drift run-to-run if input enumeration is unstable.
3. **Dirty-metric exposure:** intervention-target ratios can remain machine-readable even when guardrails fail, risking downstream overtrust.
4. **Hidden contamination mass:** no explicit counters yet for unlabeled or mixed-max-turn artifact populations.
5. **Triage friction risk:** strict failure is useful only if diagnostics are complete and class-specific at write time.

## Mitigations required (next build slices)
- Add deterministic, multi-class strict-injection checks:
  - same-label collision,
  - blank/whitespace label contamination,
  - mixed observed `maxTurnsConfigured` contamination.
- Canonicalize warning/violation ordering before persistence.
- Add contamination counters to aggregate JSON + markdown parity.
- Preserve output-boundary strict semantics (persist diagnostics, then fail).

## Reliability stance
Current strict-mode confidence is **partial** and class-limited. It is valid for same-label contamination but not yet for broader contamination families.

## Evidence status
- This lane is critique-only (no code changes, no tx).
- Produces a narrowed risk map for the next implementation lane.
