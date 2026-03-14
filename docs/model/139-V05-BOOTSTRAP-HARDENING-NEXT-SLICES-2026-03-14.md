# v05 Bootstrap Hardening — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
v05 is now deployed live on Base Sepolia at:
- Arena: `0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1`

The old deployment/ABI blocker is gone.
The next blocker is runner-side bootstrap and battle-entry reliability:
- `ensure_registered()` is not retry-safe,
- duplicate-owner registrations exist,
- owner lookup alone can misattribute success,
- registration success is not enough to justify overnight battle-volume scale-up.

This roadmap keeps the next work small, operationally useful, and explicitly testable.

## Task 1 — Receipt-bound registration resolution + stable arena-scoped identity
### Goal
Make agent bootstrap semantically idempotent for `(arena, owner)` without blind re-registration or silent identity drift.

### Smallest buildable contract
- add helper(s) that resolve **all** owned agent IDs for a given `(arena, owner)`,
- after a `registerAgent()` tx, confirm success from the tx receipt / `AgentRegistered` log when available,
- fall back to bounded owner-scan polling only if receipt parsing is unavailable or inconclusive,
- persist an arena-scoped owner→chosenAgentId mapping locally,
- verify cached ownership live before reuse,
- fail closed instead of re-registering again while state is merely uncertain.

### Acceptance criteria
1. if one or more owned agent IDs already exist for `(arena, owner)`, the runner reuses the deterministic chosen ID and does **not** send a new registration tx.
2. if registration tx succeeds and emits `AgentRegistered`, the runner resolves that exact agent ID from the receipt/log path.
3. if receipt/log parsing is unavailable, the runner polls chain state for a bounded window before concluding failure.
4. cache is scoped by arena address and owner and is validated against live ownership before reuse.
5. the runner never performs a second registration tx during mere observation uncertainty.

### Explicit guardrails
- duplicate-owner registrations must be surfaced in logs/artifacts, not silently normalized.
- deterministic selection policy must be documented (default: stable chosen ID per arena+owner mapping).

## Task 2 — Duplicate-owner observability + bootstrap artifacting
### Goal
Turn duplicate-owner registration from an invisible script quirk into an explicit metric and artifact.

### Smallest buildable contract
- extend batch artifacts/checkpoints to record:
  - all owned agent IDs seen per arena/owner,
  - chosen operational ID,
  - whether selection came from receipt, cache, or fallback polling,
  - duplicate-owner count.

### Acceptance criteria
6. every run records the chosen agent ID and the resolution method.
7. duplicate-owner counts are emitted into machine-readable artifacts.
8. if a run sees multiple owned IDs and no stable cached choice exists, the ambiguity is logged explicitly.

## Task 3 — Smoke-test ladder gate before batch-volume escalation
### Goal
Prevent overnight battle-volume scale-up until the entire battle-entry path is verified at least once on the new arena.

### Smallest buildable contract
- implement an explicit smoke-test ladder in the runner/workflow:
  1. resolve agent IDs,
  2. create battle,
  3. accept battle,
  4. submit first turn,
  5. complete one reveal cycle,
  6. settle one battle,
- refuse high battle counts until all prior rungs are satisfied.

### Acceptance criteria
9. batch volume >1 is blocked until the ladder reaches at least one settled battle on the current arena.
10. failures are labeled by ladder stage so overnight diagnostics are stage-specific, not generic.
11. the runner can resume from a partially completed smoke ladder without forgetting prior verified stages.

## Priority order
1. **Task 1 first** — biggest operational blocker and smallest useful fix.
2. **Task 2 second** — ensures overnight data quality is inspectable rather than haunted.
3. **Task 3 third** — prevents premature battle-volume escalation once bootstrap is patched.

## Next Task
**Lane B:** implement Task 1 only — receipt-bound registration resolution + arena-scoped stable agent mapping in `packages/sdk/scripts/batch-battles.py`, with deterministic behavior under duplicate-owner and observation-lag conditions.

## Explicit caveat
This roadmap does **not** claim that overnight v05 gameplay collection becomes ready after Task 1 alone. It defines the next narrow slices required to remove bootstrap ambiguity before battle-scale metrics can be trusted.
