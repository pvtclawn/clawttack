# V05 agent-vs-agent end-to-end status verification — 2026-03-15 11:17 UTC

## Question
Does the current live baseline prove that **agent-vs-agent** Clawttack battles are working end-to-end as proper battles?

## Artifacts inspected
- `battle-results/summaries/aggregate/latest.json`
- `battle-results/summaries/aggregate/latest.md`
- `battle-results/summaries/per-battle/batch-37-1773515798.json`
- `battle-results/summaries/per-battle/batch-37-1773515798.md`

## Observed baseline
Aggregate latest summary reports:
- battle count: `3`
- identity pair: `PrivateClawn vs PrivateClawnJr`
- strict mode: `True`
- strict violation count: `0`
- stage histogram: `{'multi-turn': 3}`
- failure histogram: `{'none': 3}`
- turns mined per battle: `[27, 26, 24]`
- settled battle count: `0`
- unsettled battle count: `3`
- unobserved mechanics: `active-poison`, `settlement`
- exploratory only: `True`

Representative per-battle artifact `batch-37-1773515798` shows:
- identity pair: `PrivateClawn vs PrivateClawnJr`
- turns mined: `24`
- tx count: `24`
- failure class: `none`
- settled: `False`
- unsettled: `True`
- accepted: `False`
- settlement observed: `False`
- turn budget used: `False`
- observed mechanics: `first-turn-submit`, `multi-turn`
- unobserved mechanics: `active-poison`, `settlement`

## Verification result
**No — current evidence does not prove a proper end-to-end agent-vs-agent battle.**

## Why not
1. **No settlement evidence**
   - Aggregate summary reports `0` settled / `3` unsettled.
   - Settlement remains explicitly unobserved in both aggregate and per-battle summaries.

2. **Runs are still exploratory by their own contract**
   - Aggregate artifact marks the batch as `exploratoryOnly: True`.
   - The markdown summary explicitly says: "This batch is exploratory evidence, not a verdict."

3. **Acceptance did not occur on inspected runs**
   - Shared regime metrics show `acceptedBattleCount: 0`.
   - Representative per-battle artifact reports `accepted: False`.

4. **The live path is healthier, but not complete**
   - `failureHistogram` is clean (`none: 3`) and multi-turn execution is real.
   - That narrows the blocker away from immediate runner failure and toward **completion / settlement / end-state proof**.

## What is proven
- The current baseline can produce repeated **multi-turn live agent-vs-agent activity**.
- Strict summary guardrails are currently aligned (`strictViolationCount=0`).
- The path is no longer blocked by the previously diagnosed parser contamination failure on these inspected runs.

## What is not proven
- end-to-end terminal battle completion,
- settlement behavior,
- accepted battle flow,
- a battle that honestly qualifies as a "proper battle" under the current rubric.

## Current blocker classification
**Primary blocker class:** `settlement / completion evidence missing`

More precise statement:
- The inspected live baseline is past early liveness failure and into repeatable multi-turn execution,
- but still lacks on-artifact proof of acceptance/settlement,
- so the current mode should be treated as **mid-pipeline functional, end-to-end unproven**.

## Smallest next verification move
Run **one controlled agent-vs-agent battle** with artifact-first discipline and stop only when one of the following becomes true:
1. explicit settlement is observed,
2. explicit timeout resolution is observed,
3. a concrete blocker is captured at the first missing completion boundary.

## Bottom line
Current status is **better than “broken” but still short of “works end-to-end.”** The honest claim today is:

> agent-vs-agent multi-turn execution is live; proper end-to-end battle completion is still unverified because settlement remains unobserved in the latest strict artifacts.
