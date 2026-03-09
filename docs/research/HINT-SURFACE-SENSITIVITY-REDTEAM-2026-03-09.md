# Hint-Surface Sensitivity Gate — Red-Team Findings (2026-03-09)

Input: `docs/model/030-HINT-SURFACE-SENSITIVITY-GATE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--hint-surface-sensitivity-gate-red-team.md`

## Top exploit risks
1. Hint-tier leakage via metadata/log structure.
2. Slope-metric gaming that hides absolute safety regression.
3. Critical unsafe branch-flip masking by aggregate metrics.
4. Hint realism mismatch (synthetic vs real adversarial hints).
5. Missing `hintTier × toolMode` interaction analysis.

## Hardening directions
- Obfuscate/rotate hidden tier mapping and fixture families.
- Enforce absolute per-tier floors plus slope bounds.
- Treat critical safe→unsafe branch flips as hard fail.
- Maintain realistic + adversarial hint corpora with periodic refresh.
- Stratify verdicts by tool mode and gate on interaction spikes.

## Acceptance gates for next implementation slice
1. Leakage audit confirms no developer-visible tier markers for hidden set.
2. Gate verdict requires both slope pass and per-tier floor pass.
3. Any critical branch-flip yields deterministic hard fail reason.
4. Holdout hint corpus differs from train corpus by design and version.
5. Tool-enabled tier-2 branch cannot pass if unsafe threshold breached.
