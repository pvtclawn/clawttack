# 087 — Runner Timeout Suspicion Hardening Roadmap (2026-03-11)

## Context
Task source:
- `docs/model/086-RUNNER-TIMEOUT-SUSPICION-GATE-PLAN-2026-03-11.md`

Red-team source:
- `docs/research/BATCH-RUNNER-TIMEOUT-SUSPICION-GATE-REDTEAM-2026-03-11.md`

Goal: convert timeout-suspicion red-team findings into constrained hardening tasks with deterministic acceptance criteria.

## Task 1 — Probe independence + anti-correlation confirmation gate
Implement deterministic confirmation guard requiring probe diversity and anti-correlation checks before allowing `confirmed-failure`.

### Acceptance criteria
- Correlated probe fixtures fail with `runner-timeout-confirmation-correlation-risk`.
- Independent probe sets with convergent failure evidence pass to `runner-timeout-confirmed-failure`.
- Identical tuples produce identical verdict + artifact hash.

## Task 2 — Divergence precedence + backoff-state integrity
Implement strict suspect-first handling for divergent probes and append-only retry/backoff integrity checks.

### Acceptance criteria
- Divergent probe fixtures return `runner-timeout-suspect-divergent-probes`.
- Backoff-state regressions fail with `runner-timeout-backoff-state-invalid`.
- Stable convergent traces avoid false divergence flags.

## Task 3 — Anti-flap hysteresis + weighted recovery quorum
Implement transition hysteresis/dwell controls and class-weighted recovery quorum rules before `cleared` verdict.

### Acceptance criteria
- Boundary-flap fixtures fail with `runner-timeout-window-flap-detected`.
- Partial recovery fixtures fail with `runner-timeout-cleared-insufficient-quorum`.
- Full weighted recovery quorum yields deterministic `runner-timeout-cleared`.

## Next Task (single)
Lane B: implement Task 1 in `packages/protocol` (probe-independence + anti-correlation evaluator + fixtures), no runtime wiring in same slice.
