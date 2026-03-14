# Red-Team — v05 Low-Volume Batch Collection (2026-03-14 02:26 UTC)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus
Stress-test the planned 3–5 battle scouting batch before using it to guide gameplay conclusions or scale-up decisions.

Reference artifact:
- `docs/research/APPLIED-LESSONS-V05-LOW-VOLUME-BATTLE-METRICS-2026-03-14-0224.md`

## Core question
**Why might a controlled low-volume batch still produce misleading conclusions even if it gives us real on-chain battle data?**

## Weaknesses and failure paths

### 1) Success bias from a tiny sample
One or two good-looking battles can dominate perception and create premature optimism.

**Failure path:**
- small batch contains one clear success,
- rough edges in other battles get mentally discounted,
- team overestimates stability.

**Mitigation:**
- summarize the whole batch by stage/failure counts, not by the most photogenic battle.

### 2) Identity-pair overfitting
Current runs are still a narrow `PrivateClawn` vs `PrivateClawnJr` setup.

**Failure path:**
- behavior reflects one fixed identity pair and runner configuration,
- conclusions are mistaken for general game truths.

**Mitigation:**
- record agent IDs, first mover, and identity pair explicitly in each summary,
- frame results as properties of the current pair/run setup.

### 3) Important later-turn mechanics may remain unobserved
A small batch may never reach active poison, longer reveal chains, or settlement.

**Failure path:**
- batch appears "clean",
- critical late-stage mechanics simply never occur,
- false reassurance follows.

**Mitigation:**
- explicitly report which mechanics were and were not observed.

### 4) Metrics can become too noisy to drive decisions
A grab bag of tx hashes and counters is not the same as a useful experimental summary.

**Failure path:**
- too many raw numbers,
- no clear decision signal,
- review still requires log archaeology.

**Mitigation:**
- keep a compact summary bundle: stage reached, turns, result/failure class, bank deltas, first mover, notable NCC/VOP/poison facts.

### 5) Tiny denominators can look more meaningful than they are
`0/3 failures` or `1/3 failures` is directionally useful but not stable evidence.

**Failure path:**
- team interprets tiny counts like stable rates,
- either scales too early or overcorrects too hard.

**Mitigation:**
- present counts plainly and explicitly call them exploratory, not statistically reliable.

### 6) Instrumentation gaps can still make the batch haunted
If summaries omit one key transition, the whole batch becomes hard to interpret quickly.

**Failure path:**
- one battle fails strangely,
- summaries do not say whether failure was create/accept/submit/reveal/settle,
- raw log spelunking returns.

**Mitigation:**
- require both:
  - one concise per-battle summary,
  - one aggregate stage/result summary.

## Best next actions
1. Before scaling to 3–5 battles, ensure concise per-battle summaries are emitted automatically.
2. Produce one aggregate summary with:
   - stage histogram,
   - turns reached,
   - bank-delta overview,
   - observed/unobserved mechanics,
   - notable anomalies.
3. Treat the next batch as exploratory evidence, not gameplay verdict.

## Verdict
A low-volume batch is the right next move, but it is still exposed to:
- success bias,
- identity-pair overfitting,
- unobserved late mechanics,
- noisy metrics,
- false confidence from tiny denominators,
- instrumentation gaps.

## Explicit caveat
This critique does **not** mean we should delay collection indefinitely. It means the next batch should be **small, structured, and explicitly incomplete**, so the evidence is useful without pretending to be definitive.
