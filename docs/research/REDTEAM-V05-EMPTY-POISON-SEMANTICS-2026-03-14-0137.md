# Red-Team — v05 Empty Poison Semantics (2026-03-14 01:37 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the planned empty-poison-safe validation patch before applying it to `v05-battle-loop.ts` and re-running the live smoke ladder.

Reference artifact:
- `docs/research/APPLIED-LESSONS-V05-EMPTY-CONSTRAINT-SEMANTICS-2026-03-14-0135.md`

## Core question
**Why might the obvious fix (treat empty poison as inactive) still create misleading confidence or hide the next runtime bug?**

## Weaknesses and failure paths

### 1) Inactive-poison normalization can become too permissive
If we classify too many values as "empty," we may silently skip real poison checks.

**Failure path:**
- malformed or whitespace-like poison arrives,
- local validator treats it as inactive,
- later semantics diverge from intended contract/runtime behavior.

**Mitigation:**
- use one explicit normalization rule,
- log poison mode clearly,
- document what counts as inactive.

### 2) Turn 0 success can hide later active-poison failures
Even if empty poison is handled correctly, later turns with non-empty poison can still fail for substring/casing/overlap reasons.

**Failure path:**
- first-turn tx mines,
- team assumes poison handling is solved,
- later turn with active poison fails one rung later.

**Mitigation:**
- after first-turn success, require at least one later poison-active smoke step before any battle-volume scale-up.

### 3) Substring semantics may still be locally wrong when poison is active
The current local check uses simple substring search, which may not perfectly match intended runtime semantics.

**Failure path:**
- empty-poison issue is fixed,
- active poison matching remains subtly wrong,
- next failures are harder to interpret because the obvious bug is gone.

**Mitigation:**
- keep active/inactive poison mode visible in diagnostics,
- record poison-match offset when active poison is present.

### 4) Diagnostics can get worse if we only silence the false positive
A one-line fix might remove the immediate blocker while reducing visibility into poison-mode behavior.

**Failure path:**
- `poisonPresent` just becomes `false` for empty poison,
- logs stop explaining *why*,
- later interpretation of overnight runs becomes harder.

**Mitigation:**
- add explicit `poisonMode: 'inactive' | 'active'` to diagnostics,
- preserve the rest of the validation trace.

### 5) The next failure may still be at gas estimation or tx submission
The semantics patch may unblock local validation but still not mine a first-turn tx.

**Failure path:**
- local validation passes,
- `estimateGas` fails,
- the team overestimates how much was solved.

**Mitigation:**
- require the next smoke artifact to distinguish:
  1. local validation,
  2. gas estimation,
  3. mined `submitTurn` tx.

### 6) Narrow fixes can create premature confidence loops
Recent progress has been a series of real but narrow blocker removals. This is good, but each one can tempt us to scale too early.

**Failure path:**
- empty-poison is fixed,
- overnight batch count increases too soon,
- later-step failures burn time and distort data.

**Mitigation:**
- keep the smoke ladder explicit and block scale-up until first-turn mining is real.

## Best next actions
1. Implement explicit poison-mode handling (`inactive` vs `active`) in final validation.
2. Preserve diagnostics so the reason for poison success/failure stays visible.
3. Re-run the one-battle smoke and require evidence of:
   - local validation pass,
   - gas estimation pass,
   - mined `submitTurn` tx.
4. Do not increase battle volume until the first-turn rung is proven.

## Verdict
The planned empty-poison-safe patch is directionally correct, but it is still exposed to:
- over-broad inactive-poison semantics,
- later active-poison regressions,
- substring-matching mismatch,
- degraded diagnostics,
- next-stage gas/tx failure,
- premature scale-up.

## Explicit caveat
This critique does **not** mean the patch is wrong. It means the fix should be **small, explicit, and instrumented**, so the next smoke result tells us something trustworthy instead of merely silencing one false positive.
