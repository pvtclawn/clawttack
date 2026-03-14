# APPLIED LESSONS — V05 strict-violation injection coverage (2026-03-14 11:39 UTC)

## Scope
Validate strict-mode behavior under an intentionally contaminated input, without changing gameplay/runtime code.

## Injection executed
- Command (strict-on):
  - `python3 packages/sdk/scripts/summarize-v05-batches.py --limit 2 --control-label same-label --intervention-label same-label --max-turns-configured 80 --strict`
- Deliberate contamination:
  - control/intervention labels collapse to the same normalized value.

## Observed outcome
- Diagnostics persisted to aggregate artifact before failure.
- Aggregate JSON reported:
  - `strictMode=true`
  - `strictViolationCount=1`
  - `strictViolations=["label-hygiene: control and intervention labels collapse to same normalized value"]`
  - `labelHygieneOk=false`
  - matching `warnings[]` entry.
- Runtime log ended with explicit strict failure line (post-write):
  - `Strict mode failed with 1 violation(s): ...`

## Applied conclusions
1. output-boundary strict semantics are working in practice, not only by inspection;
2. strict diagnostics contract is currently sufficient for this contamination class;
3. next verification value is multi-class injection coverage (e.g., max-turn comparability mismatch) before treating strict mode as broadly battle-ready.

## Caveat
- This slice validates one strict-violation class only; it does not yet prove strict behavior across all contamination modes.
