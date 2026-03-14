# Reliability Status — v05 pendingVop ABI-recovery smoke (2026-03-14 17:49 UTC)

## Scope
Synthesize the latest strict smoke result after the `pendingVopA/B` ABI-boundary guard patch and define the next highest-value slice.

## Evidence reviewed
- Build slice: `packages/sdk/scripts/v05-battle-loop.ts` (`fetchPendingVop()` zero-raw guard + stage-labeled decode logging)
- Verification run:
  - `CLAWTTACK_BATCH_BATTLES=1 CLAWTTACK_MAX_TURNS=120 python3 packages/sdk/scripts/batch-battles.py`
- Artifacts:
  - `battle-results/batch-17-1773510022.log`
  - `battle-results/checkpoints/batch-17-1773510022.json`

## Reliability synthesis
1. The patched pending VOP boundary cleared the immediate failure: no `pendingVopB` `BAD_DATA` decode error appeared in the strict smoke.
2. Decode-stage telemetry remained healthy (`decode-ok` observed repeatedly for pending VOP fetch).
3. The smoke progressed through multiple turns and reached terminal phase (`phase=2`) with checkpoint persistence.
4. This removes the current blocker for `pendingVopB` decode in the tested path, but does **not** yet prove broad robustness across all interface-drift classes.

## Current confidence statement (narrow, evidence-backed)
- **Supported claim:** pending-VOP ABI-boundary recovery works for the latest strict one-battle smoke path.
- **Unsupported claim (do not make yet):** generalized settlement reliability across wider battle volume and all decode surfaces.

## Next slice (Task 2)
Implement failure-taxonomy split in summarization/review artifacts:
- classify interface-boundary decode failures as `interface-decode/*`
- keep mechanism/runtime failures under `runtime/*`
- ensure `unknown` is no longer a catch-all for decode drift

## Gate before scale-up
Do not scale collection volume until one additional strict labeled run confirms:
- zero `pendingVopB` decode failures,
- taxonomy split is visible in artifacts,
- strict/comparability guardrails remain green.
