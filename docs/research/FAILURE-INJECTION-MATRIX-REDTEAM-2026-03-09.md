# Failure Injection Matrix — Red-Team Findings (2026-03-09)

Input: `docs/model/022-FAILURE-INJECTION-MATRIX-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--failure-injection-matrix-red-team.md`

## Top exploit risks
1. Fixture gaming/overfitting to known scenarios.
2. Replay-hash spoofing when run-context binding is incomplete.
3. False-confidence from narrow failure taxonomy (missing compound failures).
4. Determinism metric masking liveness regressions.
5. Resource-amplification abuse via oversized fixtures.

## Hardening directions
- Introduce hidden rotating fixtures + perturbation windows.
- Bind replay hash to full run context (seed/version/config/module-set).
- Add mandatory compound-failure scenarios.
- Gate on liveness + reject precision, not determinism alone.
- Enforce fixture complexity budgets and timeout caps.

## Acceptance gates for next implementation slice
1. Hidden fixture pass rate is reported separately from public fixtures.
2. Replay-hash context completeness checks fail closed on missing metadata.
3. At least one compound failure case exists for each guardrail module.
4. Liveness/precision metrics meet thresholds in addition to deterministic verdict checks.
5. Stress profile remains inside configured runtime/memory limits.
