# V05 bounded epoch-transition windows for anchor lineage — guidance (2026-03-15 08:05 UTC)

## Question
How do we allow legitimate epoch transitions in anti-replay anchor checks without creating replay bypass windows?

## Reading-derived conclusion
Use a **bounded transition contract** (consistent-hashing-style minimal relocation principle): epoch rollover should preserve lineage continuity and limit post-rollover sequence jump, rather than permitting unconstrained resets.

## Recommended extension
Add transition-bound metadata:
- `anchorEpochTransitionWindowSize`
- `anchorEpochTransitionId`
- `anchorTransitionCarryoverDigest`
- `anchorTransitionWithinBound`

## Deterministic policy
1. Epoch bump requires carryover digest match with last accepted lineage snapshot.
2. Post-bump sequence movement must remain within configured transition window.
3. Missing carryover digest or oversized jump fail-closes as replay-skew class.

## One-battle acceptance criteria (next verify slice)
- Fixture A: epoch+1 with matching carryover digest + bounded jump => pass.
- Fixture B: epoch+1 with wrong/missing carryover digest => replay-skew invalid.
- Fixture C: epoch+1 with jump > transition window => replay-skew invalid.
- Markdown/json both surface transition-bounded status + explicit reason code.

## Caveat
Guidance artifact only; no live on-chain claim.
