# REDTEAM — V05 Turn-Budget Accounting (2026-03-14 09:44 UTC)

## Objective under review
Implement used-vs-unused max-turn accounting in `summarize-v05-batches.py` without degrading evidence quality.

## Weaknesses identified
1. **Budget usage may be mis-attributed** if battles end early for reasons unrelated to tactical ceiling.
2. **Turn index semantics can drift** (mined turn count vs phase/currentTurn).
3. **Tiny-sample ratio confidence is fragile** and can be misread as stable signal.
4. **Label hygiene is brittle**; missing control/intervention labels can poison comparisons.
5. **Snapshot-time uncertainty** for unsettled battles can bias used/unused counts.

## Required safeguards
- Define and use one canonical budget-usage formula across per-battle + aggregate outputs.
- Include `settled/unsettled` context with budget metrics.
- Keep budget-usage stats partitioned under intervention-target metrics.
- Show a mandatory tiny-sample caveat in markdown aggregate output.
- Preserve explicit control/intervention labels in all outputs.

## Decision
Proceed with a small, explicit Lane B implementation. Do not scale batch volume based on budget ratios alone.
