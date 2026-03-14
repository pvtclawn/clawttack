# Applied Lessons: v05 comparability + label-hygiene guardrails (2026-03-14 10:39)

## Context
Current summary path already has intervention-target turn-budget aggregates. Remaining risk is interpretation drift from missing labels, mixed max-turn configurations, and tiny denominators.

## Lessons mapped to implementation
1. **Label precondition as explicit guardrail**
   - Add `labelHygieneOk` and structured warnings when control/intervention labels are missing or placeholder-like.
2. **Comparability precondition as explicit guardrail**
   - Add `maxTurnsComparable` and warnings when per-battle `maxTurnsConfigured` is mixed in the same aggregate window.
3. **Denominator clarity must remain machine-readable**
   - Preserve `turnBudgetRatioDenominator` and co-report denominator count in intervention-target metrics.
4. **Human caveat parity**
   - Markdown output should mirror guardrail booleans and warnings so review doesn’t rely on JSON-only checks.

## Acceptance intent for next build slice
- Aggregate JSON includes `labelHygieneOk`, `maxTurnsComparable`, and warning arrays.
- Aggregate Markdown surfaces same guardrail status + warnings.
- Labeled refresh can prove parity without manual inference.

## Caveat
This lane is learning/design only; no summarizer logic changed yet.
