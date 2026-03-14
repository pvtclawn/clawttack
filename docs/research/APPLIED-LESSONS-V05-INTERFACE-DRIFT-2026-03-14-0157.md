# Applied Lessons — v05 Interface Drift (2026-03-14 01:57 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/003_solid_software.pdf`
- Focused ideas: make implicit contracts explicit, keep stories small/testable, align boundary adapters with the true contract, validate behavior with concrete pre/postconditions.

## Why this source is relevant
The latest live v05 smoke no longer fails on gameplay semantics first. It now fails at a narrower adapter boundary:
- `pendingNccA/B()` decoding in `v05-battle-loop.ts`
- live contract shape = 4 fields
- runner ABI shape = stale/older declaration
- result = `BAD_DATA` before first-turn logic continues

This is not a mechanism-design problem. It is interface drift.

## Applied lessons

### 1) ABI tuple shape is part of the contract
The return shape is not a minor implementation detail; it is part of the interface contract.

**Applied rule:** treat the runner's ABI literal as a first-class contract boundary that must match live Solidity exactly.

### 2) Fix boundary drift at the adapter itself
Retries and defensive wrappers are the wrong first response.

**Applied rule:** correct the `pendingNccA/B` getter ABI where it is declared in the runner before adding any other logic.

### 3) Keep the next slice tiny and testable
This is an ideal small story:
- correct getter shape,
- rerun smoke,
- observe whether the ladder advances beyond decode.

### 4) Judge the fix by behavior, not by code shape alone
The patch is successful only if live decode succeeds and the smoke ladder moves to the next stage.

**Applied rule:** verify with one live battle, not just static review.

### 5) Boundary drift should later be made harder to introduce
Literal ABI duplication invites drift.

**Applied rule:** once the immediate blocker is gone, consider centralizing/generating ABI fragments from a shared source.

## Concrete next build contract
Patch `packages/sdk/scripts/v05-battle-loop.ts` so:
- `pendingNccA()`
- `pendingNccB()`

return tuple declarations match the live `PendingNcc` shape exactly.

## Smallest next slice
Implement the ABI-shape correction and immediately rerun the one-battle smoke on the live v05 arena.

## Explicit caveat
This note does **not** claim that first-turn submission will definitely work after the ABI patch. It narrows the next blocker to a specific boundary mismatch that should be removed before making any further gameplay claims.
