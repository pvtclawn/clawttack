# Red-Team: V05 Task 2 Guardrails (Comparability + Label Hygiene)

## Trigger
Heartbeat Lane F challenge to stress-test planned guardrail implementation before coding.

## Target
`packages/sdk/scripts/summarize-v05-batches.py` Task 2:
- comparability guardrails,
- label-hygiene warnings.

## Key failure modes
1. **Label hygiene passes trivial junk labels** (`control=foo`, `intervention=bar`) and still looks valid.
2. **Comparability declared from config, not evidence**, missing mixed historical runs.
3. **Warnings not machine-readable**, so automation ignores contamination.
4. **Aggregate contamination by stale artifacts** when summary refresh mixes file sets.
5. **Ratio denominator semantically dirty** despite being syntactically explicit.

## Required implementation safeguards
- Keep guardrail status in aggregate JSON:
  - `labelHygieneOk`, `maxTurnsComparable`, `warnings[]`.
- Add label integrity checks:
  - non-empty, normalized, distinct labels.
- Track contamination counters:
  - unlabeled/mismatched battle counts.
- Add strict mode option to fail fast when guardrails fail.
- Mirror the same guardrail status and warnings in Markdown.

## Acceptance gate for next lane
Task 2 should be considered done only if:
1. JSON contains guardrail booleans + structured warnings,
2. markdown mirrors the same status,
3. labeled refresh demonstrates both a clean case and at least one warning path,
4. turn-budget ratios remain explicitly intervention-scoped.

## Caveat
This document narrows risks; it does not implement fixes.
