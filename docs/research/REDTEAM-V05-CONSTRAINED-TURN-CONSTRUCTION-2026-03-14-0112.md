# Red-Team — v05 Constrained Turn Construction (2026-03-14 01:12 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the planned deterministic candidate→narrative coupling patch before resuming live smoke tests on the new v05 arena.

Reference artifact:
- `docs/research/APPLIED-LESSONS-V05-CONSTRAINED-TURN-CONSTRUCTION-2026-03-14-0107.md`

## Core question
**Why might a deterministic narrative-construction patch still produce bad gameplay, weak data, or the next runtime failure even if it eliminates `candidate encoding failed`?**

## Weaknesses and failure paths

### 1) Template safety can collapse into strategic boredom
A rigid template may satisfy every hard constraint while making turns repetitive and low-information.

**Failure path:**
- one safe template dominates,
- narrative diversity collapses,
- gameplay becomes script-like,
- later conclusions about mechanics are polluted by template monotony.

**Mitigation:**
- use a small family of safe templates,
- track template distribution in artifacts,
- watch for collapse into one dominant template.

### 2) Post-hoc byte clipping can still break the final string
If the builder still trims strings after construction, required words or boundaries may be damaged after offsets were conceptually chosen.

**Failure path:**
- initial text contains all required words,
- budget trimming cuts or distorts the tail,
- final offsets/semantics drift,
- runtime fails or narratives become malformed.

**Mitigation:**
- construct under budget by design,
- validate only the final emitted string,
- avoid destructive trimming on required tokens.

### 3) Poison handling can remain brittle even if candidate inclusion is fixed
A deterministic constructor can still mishandle poison avoidance if it depends on late substitutions or inconsistent normalization.

**Failure path:**
- candidate inclusion succeeds,
- poison-word exclusion fails under casing/morphology/substring overlap,
- first-turn tx now fails one rung later.

**Mitigation:**
- validate poison exclusion on the final normalized string,
- compose from pre-screened safe filler phrases instead of sanitizing late.

### 4) Too much deterministic structure can leak NCC patterns
Always placing candidate words in the same order or syntax could make defender guesses easier.

**Failure path:**
- turn submission succeeds,
- NCC attack structure becomes more predictable,
- defender-guess success rises for the wrong reason.

**Mitigation:**
- keep a small deterministic-but-varied template/order set,
- measure post-fix defender-guess rates and candidate-order diversity.

### 5) Solving the local exception may still leave the next contract/runtime failure untouched
A locally valid narrative is not automatically an on-chain-valid turn.

**Failure path:**
- local validation passes,
- `estimateGas` or tx submission fails due to another payload constraint,
- the team overestimates how much the patch actually solved.

**Mitigation:**
- gate success by a smoke ladder:
  1. local validity,
  2. `estimateGas`,
  3. first-turn tx mined,
  4. next-turn reveal still coherent.

### 6) Regeneration/fallback can bias the overnight dataset
If fallback keeps replacing candidates until it finds easy short safe words, battle data becomes skewed.

**Failure path:**
- fixes bias candidate choice toward simple/frequent/short words,
- overnight run metrics stop reflecting intended gameplay pressure,
- conclusions about NCC difficulty become less trustworthy.

**Mitigation:**
- record regeneration counts, candidate lengths, and fallback usage,
- prefer alternate templates before replacing the candidate set,
- flag when fallback usage becomes common.

## Best next actions
1. Implement deterministic under-budget narrative construction.
2. Validate the **final** emitted string for all hard constraints, including poison exclusion.
3. Emit template/fallback diagnostics so valid-but-boring collapse becomes measurable.
4. Prove success through a first-turn smoke ladder, not just local string validation.

## Verdict
The planned patch is directionally right, but it is still exposed to:
- valid-but-boring equilibrium,
- byte-budget corruption,
- poison-fragile text,
- overpredictable NCC structure,
- local-valid / contract-invalid mismatch,
- dataset bias through regeneration.

## Explicit caveat
This critique does **not** mean the deterministic-construction fix is wrong. It means the patch should be built as a **mechanically valid but instrumented** slice, so the overnight data remains trustworthy once first-turn submission is unblocked.
