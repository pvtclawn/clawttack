# Dual-Clock Timeout Evidence — Red-Team Findings (2026-03-09)

Input: `docs/model/018-DUAL-CLOCK-TIMEOUT-EVIDENCE-PLAN-2026-03-09.md`
Companion critique log: `memory/challenges/2026-03-09--dual-clock-timeout-evidence-red-team.md`

## Top exploit risks
1. **Suspect-state farming**: deliberate cycling into suspect without confirm to stall and drain opponent budget.
2. **Heartbeat spoof semantics**: emitting liveness-shaped signals without real turn progress.
3. **2-of-3 threshold gaming**: optimizing one manipulable signal to keep confirmation below threshold.
4. **Evidence desync**: logical/physical signal disagreement under partition-like conditions.
5. **Confirmation latency griefing**: extending unresolved suspect windows to degrade throughput.

## Hardening directions (pre-implementation)
- Add suspect-cycle cap + escalating debt toward confirm.
- Couple heartbeat evidence to sequence/progress proofs.
- Replace flat 2-of-3 with manipulability-aware decision weighting.
- Encode deterministic precedence for conflicting evidence classes.
- Bound suspect lifetime with deterministic fallback path.

## Acceptance gates for next implementation slice
1. Adversarial simulation shows suspect-farming EV is non-positive.
2. Heartbeat-only/no-progress evidence cannot prevent confirm indefinitely.
3. Replay harness yields deterministic confirm outcomes for fixed evidence traces.
4. Throughput/liveness metrics remain within configured SLO bounds.
