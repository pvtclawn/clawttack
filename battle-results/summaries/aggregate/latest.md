# batch-summary

- control label: `baseline-same-regime`
- intervention label: `max-turns-intervention`
- battle count: `3`
- settled vs unsettled: `0` settled / `3` unsettled
- notable anomalies: none

## shared-regime metrics
- stage histogram: `{'multi-turn': 3}`
- failure histogram: `{'none': 3}`
- turns mined per battle: `[20, 20, 20]`
- first movers A: `[False, False, True]`
- accepted battle count: `0`

## intervention-target metrics
- intervention-scope battle count: `3`
- turn-budget used count: `0`
- turn-budget unused count: `3`
- turn-budget used ratio: `0.0` (denominator: `interventionTargetMetrics.battleCount`)
- paired evidence scope: `interventionTargetMetrics`
- paired evidence denominator: `interventionTargetMetrics.battleCount`
- paired evidence sample size: `3`
- unsettled share: `1.0`
- first mover A share: `0.3333333333333333`
- exploratory only: `True`
- later-turn battle count: `3`
- active-poison battle count: `0`
- settlement observed count: `0`
- observed mechanics: first-turn-submit, multi-turn
- unobserved mechanics: active-poison, settlement

## guardrails
- strict mode: `True`
- strict violation count: `0`
- strict violations: none
- label hygiene ok: `True`
- max turns comparable: `True`
- single-variable intervention guardrail: `True` for `maxTurnsConfigured` values `[80]`
- run-config fingerprint: `911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- warnings: none
- contamination counters: `{'labelControlBlankCount': 0, 'labelInterventionBlankCount': 0, 'labelCollapseCount': 0, 'maxTurnsMismatchCount': 0}`

## comparison
- previous control/intervention: `baseline-same-regime` / `max-turns-intervention`
- current control/intervention: `baseline-same-regime` / `max-turns-intervention`
- previous run-config fingerprint: `911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- current run-config fingerprint: `911f2381ec1681b975b3aaee488009d4cc137b6f41a99aae1d5f992b0e77090f`
- previous battle count: `3`
- current battle count: `3`
- previous shared metrics: `{'battleCount': 3, 'stageHistogram': {'multi-turn': 3}, 'failureHistogram': {'none': 3}, 'turnsMinedPerBattle': [20, 20, 20], 'firstMoversA': [False, False, True], 'identityPairs': ['PrivateClawn vs PrivateClawnJr'], 'acceptedBattleCount': 0}`
- current shared metrics: `{'battleCount': 3, 'stageHistogram': {'multi-turn': 3}, 'failureHistogram': {'none': 3}, 'turnsMinedPerBattle': [20, 20, 20], 'firstMoversA': [False, False, True], 'identityPairs': ['PrivateClawn vs PrivateClawnJr'], 'acceptedBattleCount': 0}`
- previous intervention-target metrics: `{'battleCount': 3, 'turnBudgetRatioDenominator': 'interventionTargetMetrics.battleCount', 'turnBudgetUsedCount': 0, 'turnBudgetUnusedCount': 3, 'turnBudgetUsedRatio': 0.0, 'laterTurnBattleCount': 3, 'activePoisonBattleCount': 0, 'settlementObservedCount': 0, 'pairedEvidenceScope': 'interventionTargetMetrics', 'pairedEvidenceDenominator': 'interventionTargetMetrics.battleCount', 'sampleSize': 3, 'unsettledShare': 1.0, 'firstMoverAShare': 0.3333333333333333, 'exploratoryOnly': True, 'observedMechanics': ['first-turn-submit', 'multi-turn'], 'unobservedMechanics': ['active-poison', 'settlement']}`
- current intervention-target metrics: `{'battleCount': 3, 'turnBudgetRatioDenominator': 'interventionTargetMetrics.battleCount', 'turnBudgetUsedCount': 0, 'turnBudgetUnusedCount': 3, 'turnBudgetUsedRatio': 0.0, 'laterTurnBattleCount': 3, 'activePoisonBattleCount': 0, 'settlementObservedCount': 0, 'pairedEvidenceScope': 'interventionTargetMetrics', 'pairedEvidenceDenominator': 'interventionTargetMetrics.battleCount', 'sampleSize': 3, 'unsettledShare': 1.0, 'firstMoverAShare': 0.3333333333333333, 'exploratoryOnly': True, 'observedMechanics': ['first-turn-submit', 'multi-turn'], 'unobservedMechanics': ['active-poison', 'settlement']}`
- previous unsettled: `3`
- current unsettled: `3`
- newly observed mechanics: none
- still unobserved mechanics: active-poison, settlement

> This batch is exploratory evidence, not a verdict.
> Tiny-sample caveat: sample size is `3` (denominator `interventionTargetMetrics.battleCount`); treat all intervention metrics as directional only.
