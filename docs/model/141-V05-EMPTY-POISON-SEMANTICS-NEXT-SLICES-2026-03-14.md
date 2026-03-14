# v05 Empty Poison Semantics — Next Slices (2026-03-14)

## Trigger
Heartbeat Lane A (PLAN).

## Context
The v05 smoke ladder now reaches live:
- deterministic bootstrap,
- battle creation,
- battle acceptance,
- candidate-valid first-turn narrative construction.

The next blocker is narrower:
- `poisonWord()` can be empty on turn `0`,
- final validation currently treats empty poison as present in every narrative,
- therefore valid first-turn templates are still rejected pre-submit.

The latest red-team pass narrowed the main risks around the intended fix to:
1. over-broad inactive-poison normalization,
2. later active-poison regressions,
3. local substring-semantics mismatch,
4. degraded diagnostics,
5. next-stage gas/tx failure,
6. premature scale-up after a narrow semantics win.

This roadmap keeps the next work tiny, explicit, and measurable.

## Task 1 — Explicit poison-mode handling + preserved diagnostics
### Goal
Fix empty-poison semantics without hiding later active-poison failures or weakening validation visibility.

### Smallest buildable contract
- normalize poison exactly once at the validation boundary,
- distinguish explicit poison modes:
  - `inactive` — empty/absent poison,
  - `active` — non-empty poison string,
- treat inactive poison as vacuously satisfied,
- preserve all existing final-string checks,
- extend diagnostics to include:
  - poison mode,
  - normalized poison value,
  - matched poison offset when poison is active and present.

### Acceptance criteria
1. empty poison no longer causes every narrative to fail validation.
2. active poison still uses explicit forbidden-substring validation on the final emitted narrative.
3. diagnostics clearly report `poisonMode: inactive | active`.
4. when poison is active and present, diagnostics include the matched offset.
5. the fix is localized to validation semantics; it does not silently weaken target/candidate/byte-budget checks.

## Task 2 — First-turn smoke-ladder proof after semantics patch
### Goal
Prove the semantics fix actually advances the live ladder beyond local validation.

### Smallest buildable contract
- re-run one-battle live smoke on the v05 arena,
- capture whether the runner now reaches:
  1. local validation pass,
  2. gas estimation pass,
  3. mined `submitTurn` tx.

### Acceptance criteria
6. smoke artifact distinguishes local validation, gas estimation, and mined tx stages explicitly.
7. batch volume remains `1` until at least one first-turn tx is mined.
8. if first-turn still fails, the next blocker is recorded as a narrower stage-specific artifact, not a generic loop failure.

## Task 3 — Active-poison follow-up proof before scale-up
### Goal
Avoid mistaking turn-0 empty-poison success for full poison-path correctness.

### Smallest buildable contract
- after first-turn success, verify at least one later smoke step where poison is non-empty,
- compare active-poison diagnostics with on-chain behavior before increasing battle volume.

### Acceptance criteria
9. at least one smoke note records a turn where poison mode is `active`.
10. no battle-volume increase occurs before active-poison behavior is observed or explicitly waived with rationale.
11. later poison failures are labeled as active-poison semantics failures rather than being folded into generic turn errors.

## Priority order
1. **Task 1 first** — smallest change and direct blocker removal.
2. **Task 2 second** — proves whether the semantics fix moves the live ladder.
3. **Task 3 third** — prevents overclaim after turn-0 success.

## Next Task
**Lane B:** implement Task 1 only — explicit poison-mode handling + preserved diagnostics in `packages/sdk/scripts/v05-battle-loop.ts`.

## Explicit caveat
This roadmap does **not** claim that fixing empty-poison semantics makes v05 battle-ready. It defines the next narrow slices required to mine the first-turn tx without hiding later active-poison or runtime-stage failures.
