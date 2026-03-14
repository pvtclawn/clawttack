# v05 Constrained Turn Construction — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
The new v05 Base Sepolia arena is live and the smoke ladder now reaches:
- deterministic bootstrap,
- battle creation,
- battle acceptance.

The next blocker is local and narrow:
- `packages/sdk/scripts/v05-battle-loop.ts` can declare NCC candidate words that are not actually embedded in the generated narrative,
- causing `candidate encoding failed` before the first turn tx is submitted.

The latest red-team pass narrowed the main risks around the intended fix to:
1. valid-but-boring template collapse,
2. byte-budget corruption after construction,
3. poison-fragile final strings,
4. overpredictable NCC structure,
5. local-valid / contract-invalid mismatch,
6. fallback-induced dataset bias.

This roadmap keeps the next work mechanically useful, measurable, and small.

## Task 1 — Deterministic under-budget narrative construction + final-string validation
### Goal
Guarantee that a first-turn narrative is mechanically valid before payload assembly, without relying on destructive clipping or free-form generation luck.

### Smallest buildable contract
- replace or wrap the current narrative constructor with a deterministic constructor that starts from:
  - target word,
  - all four chosen NCC candidate words,
  - safe filler phrase families,
- construct under the byte budget by design,
- validate the **final emitted string** for:
  - target inclusion,
  - all four candidate words embedded,
  - poison exclusion,
  - byte budget,
- if construction fails, try bounded alternate safe templates before changing candidate words,
- if still unresolved, emit structured diagnostics and fail closed.

### Acceptance criteria
1. first-turn narrative construction no longer relies on post-hoc tail trimming of required tokens.
2. final-string validation runs on the exact emitted narrative, not an earlier intermediate string.
3. all four candidate words are guaranteed present before offsets are computed.
4. poison exclusion is checked on the final normalized string.
5. failure output includes structured diagnostics: target, candidates, offsets found/missing, byte length, and template/fallback path used.

## Task 2 — Template/fallback observability and anti-boredom metrics
### Goal
Prevent the deterministic fix from quietly collapsing overnight gameplay into a single sterile template or biased candidate distribution.

### Smallest buildable contract
- record in run artifacts:
  - template family used,
  - candidate order,
  - fallback count,
  - candidate lengths,
  - whether candidate set was regenerated,
- flag heavy collapse conditions in logs/artifacts.

### Acceptance criteria
6. every submitted turn records template family and fallback count.
7. candidate regeneration is measurable rather than silent.
8. logs/artifacts make it possible to detect if one template family dominates the run.

## Task 3 — First-turn smoke ladder gate before battle-volume scale-up
### Goal
Prevent premature overnight batch scaling after local construction appears fixed.

### Smallest buildable contract
- require the next live smoke ladder to pass in order:
  1. local narrative validation,
  2. `estimateGas` for `submitTurn`,
  3. first-turn tx mined,
  4. next-turn reveal still coherent,
- keep batch volume at 1 until at least one first-turn tx is mined successfully.

### Acceptance criteria
9. battle volume >1 remains blocked until at least one first-turn tx is mined on the live v05 arena.
10. failures are labeled by smoke-ladder stage, not reported as a generic loop failure.
11. reveal-path coherence remains explicitly checked after first-turn success.

## Priority order
1. **Task 1 first** — smallest operational blocker removal and directly tied to first-turn submission.
2. **Task 2 second** — keeps overnight data trustworthy once first-turn success returns.
3. **Task 3 third** — prevents scale-up before the next rung is actually proven.

## Next Task
**Lane B:** implement Task 1 only — deterministic under-budget narrative construction plus final-string validation in `packages/sdk/scripts/v05-battle-loop.ts`, with structured diagnostics on failure.

## Explicit caveat
This roadmap does **not** claim that v05 gameplay becomes trustworthy after Task 1 alone. It defines the next narrow slices needed to unblock first-turn submission without silently degrading gameplay quality or polluting overnight battle metrics.
