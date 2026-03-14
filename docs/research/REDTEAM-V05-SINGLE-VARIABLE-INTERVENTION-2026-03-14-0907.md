# Red-Team — v05 Single-Variable Intervention (2026-03-14 09:07 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the planned next experiment after two same-regime low-volume scouting batches: preserve the baseline regime, vary exactly one explicit parameter, and use that intervention to expose mechanics the control batches still did not reach.

## Core question
**Why might a supposedly clean single-variable intervention still mislead us, weaken comparability, or produce the wrong kind of novelty?**

## Weaknesses and failure paths

### 1) "Single variable" can still hide several effective changes
Increasing `CLAWTTACK_MAX_TURNS` is a narrow knob on paper, but in practice it can also change:
- gas exposure,
- battle duration,
- timeout likelihood,
- settlement reachability,
- poison-activation opportunity,
- and the amount of narrative surface available to each side.

That means the intervention is legible, but not consequence-free.

**Mitigation:**
- state clearly that the declared intervention is `max-turns`,
- treat downstream differences as expected consequences of that intervention,
- do not pretend the reachable battle surface is otherwise identical.

### 2) Better mechanic coverage can reduce direct comparability
If the intervention exposes later-turn or settlement mechanics that the baseline never reached, that is valuable — but it also means some naive rate comparisons stop being apples-to-apples.

**Mitigation:**
- separate **shared-regime metrics** from **intervention-target metrics**,
- keep early-stage health comparable (create / accept / first submit / early turns),
- treat later-turn / settlement visibility as "coverage gained", not just as another percentage in the same bucket.

### 3) Missing intervention labels can silently poison later interpretation
If summaries, checkpoints, or review docs fail to preserve baseline vs intervention identity, the evidence loop will rot into later ambiguity.

**Mitigation:**
- require a stable intervention label in batch summaries and aggregate comparison,
- name the control explicitly,
- preserve that label all the way into the review note.

### 4) A longer turn cap may amplify side asymmetry rather than reveal richer play
More turns can mean more mechanics — or just more time for one side to exploit a structural advantage.

**Mitigation:**
- keep first mover / side / bank-delta visibility explicit,
- flag repeated one-sided snowball patterns as a separate finding from "mechanics reached".

### 5) The added turn budget may not actually get exercised
A higher cap does not matter if battles still terminate, stall, or fail for the same shallow reasons as before.

**Mitigation:**
- record whether battles actually used the larger turn budget,
- keep observed vs unobserved mechanics explicit,
- note when the intervention changed the ceiling but not the realized path.

### 6) Tiny intervention samples are easy to over-narrativize
If a small intervention batch shows one settlement, one active-poison event, or one dramatic late turn, it will be tempting to tell a bigger story than the denominator supports.

**Mitigation:**
- frame the batch as an exploratory probe,
- describe deltas directionally,
- avoid claims of stable rates or broad robustness from a tiny sample.

### 7) Observability debt can be mistaken for gameplay change
The next apparent delta may come from better summaries or stage logging rather than from real mechanic change.

**Mitigation:**
- keep stage labels explicit,
- distinguish gameplay absence from measurement absence,
- note any raw-artifact gaps separately from battle outcomes.

## Best next actions
1. Run exactly one labeled intervention batch.
2. Keep the identity pair / stake / warmup / general flow unchanged.
3. Vary only the chosen turn-cap parameter.
4. Compare baseline vs intervention using explicit:
   - settled vs unsettled battle count,
   - turns-mined distribution,
   - first mover / side visibility,
   - observed vs unobserved mechanics,
   - whether the added turn budget was actually exercised.
5. Decide afterward whether to:
   - replicate the intervention,
   - vary a different parameter,
   - or add instrumentation.

## Verdict
The intervention is worth running, but it is still exposed to:
- hidden multi-effect changes,
- reduced direct comparability,
- label drift in artifacts,
- side-asymmetry amplification,
- overclaiming from tiny exploratory deltas,
- and measurement-vs-gameplay confusion.

## Explicit caveat
This critique does **not** argue against the intervention batch. It argues for running it as a tightly labeled exploratory probe so the project learns something new without hallucinating that "different" automatically means "better understood."

## Next Task
Lane A: turn this critique into 1–3 crisp build/verify tasks with acceptance criteria, prioritizing intervention labeling, shared-vs-target metric separation, and explicit used-vs-unused turn-budget accounting before running the next small batch.
