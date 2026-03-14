# v05 pendingNcc ABI Drift — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
The v05 smoke ladder now reaches live:
- deterministic bootstrap,
- battle creation,
- battle acceptance,
- candidate-valid first-turn narrative construction,
- empty-poison-safe final validation.

The next blocker is now implementation drift at the runner boundary:
- `packages/sdk/scripts/v05-battle-loop.ts` still decodes `pendingNccA()` / `pendingNccB()` using a stale tuple shape,
- the live contract returns a 4-field `PendingNcc`,
- ethers throws `BAD_DATA` before first-turn payload assembly can continue.

The latest red-team pass narrowed the main risks around the intended fix to:
1. neighboring getter drift,
2. semantic misuse after decode,
3. overclaim after decode success,
4. recurring literal-ABI drift,
5. weak stage logging,
6. stale copied declarations elsewhere.

This roadmap keeps the next work tiny, exact, and measurable.

## Task 1 — Exact `pendingNccA/B` getter-shape correction + stage-labeled smoke logging
### Goal
Remove the stale getter boundary so the live smoke ladder can advance beyond decode, while preserving enough stage visibility to identify the next failure precisely.

### Smallest buildable contract
- patch the runner ABI for:
  - `pendingNccA()`
  - `pendingNccB()`
- match the live `PendingNcc` shape exactly:
  1. `bytes32 commitment`
  2. `uint16[4] candidateWordIndices`
  3. `uint8 defenderGuessIdx`
  4. `bool hasDefenderGuess`
- keep downstream use of decoded fields gated by presence flags,
- add or preserve stage-oriented log markers around:
  - pending-state fetch,
  - payload assembly,
  - gas estimation,
  - tx send.

### Acceptance criteria
1. `pendingNccA/B` decode succeeds against the live v05 battle contract.
2. decoded `defenderGuessIdx` is not treated as meaningful unless `hasDefenderGuess` is true.
3. the next smoke artifact explicitly distinguishes:
   - decode success,
   - payload assembly success,
   - gas estimation success,
   - mined `submitTurn` tx success/failure.
4. the patch is localized to the runner boundary and does not alter unrelated game semantics.

## Task 2 — Neighboring tuple-getter audit after smoke advancement
### Goal
Prevent one fixed getter from simply revealing the next stale tuple boundary with no preparation.

### Smallest buildable contract
- after the `pendingNcc` fix advances the smoke ladder, compare runner ABI declarations against live contract shapes for:
  - `pendingVopA/B`
  - `getBattleState()`
  - any other tuple-return getter used in the runner.

### Acceptance criteria
5. the audit records whether neighboring tuple getters are aligned or potentially stale.
6. any newly found drift is documented before battle-volume scale-up.

## Task 3 — Shared-boundary cleanup after first-turn progress
### Goal
Reduce the chance of the same stale getter contract surviving elsewhere in the repo.

### Smallest buildable contract
- grep for other literal declarations of `pendingNccA/B` tuple shapes,
- document or update them once the runner path is proven.

### Acceptance criteria
7. stale copied declarations are either updated or logged as known follow-up debt.
8. the repo no longer contains silent disagreement about the live `PendingNcc` shape across active battle surfaces.

## Priority order
1. **Task 1 first** — direct blocker removal and smallest useful slice.
2. **Task 2 second** — keeps the next smoke result interpretable.
3. **Task 3 third** — reduces recurring drift after the runner is unblocked.

## Next Task
**Lane B:** implement Task 1 only — exact `pendingNccA/B` getter-shape correction plus stage-labeled smoke logging in `packages/sdk/scripts/v05-battle-loop.ts`.

## Explicit caveat
This roadmap does **not** claim that first-turn submission will definitely work after the `pendingNcc` fix. It defines the next narrow slices needed to remove the current boundary mismatch and measure exactly how far the live smoke ladder moves afterward.
