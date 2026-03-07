#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type MatchmakerMode = 'random' | 'weak_anti_repeat' | 'strong_anti_repeat'
type PopulationProfile = {
  honestAdaptive: number
  scriptedExploiters: number
  colluders: number
}

type SabotageMode = 'none' | 'false_flag_poisoning' | 'telemetry_degradation'

type DegradedModePolicy = {
  payoutCapRatio: number
  multiplierCap: number
  degradeAbuseCounterThreshold: number
}

type Scenario = {
  id: string
  coalitionSize: 2 | 3 | 5
  population: PopulationProfile
  matchmaker: MatchmakerMode
  sabotage: SabotageMode
  degradedModePolicy: DegradedModePolicy
  epochs: number
  battlesPerEpoch: number
  trackedOutputs: string[]
  acceptanceChecks: string[]
}

type ScaffoldArtifact = {
  generatedAt: string
  purpose: string
  status: 'scaffold'
  assumptions: {
    rewardModel: string
    penaltyModel: string
    qualityGateModel: string
    degradedModePolicy: DegradedModePolicy
  }
  scenarioCounts: {
    total: number
    byCoalition: Record<string, number>
    byMatchmaker: Record<MatchmakerMode, number>
    bySabotage: Record<SabotageMode, number>
  }
  scenarios: Scenario[]
  nextImplementationSteps: string[]
}

const EPOCHS = Number(process.env.COLLUSION_EPOCHS ?? '12')
const BATTLES_PER_EPOCH = Number(process.env.COLLUSION_BATTLES_PER_EPOCH ?? '200')

const BASE_DEGRADED_PAYOUT_CAP_RATIO = Number(process.env.DEGRADED_PAYOUT_CAP_RATIO ?? '0.6')
const BASE_DEGRADED_MULTIPLIER_CAP = Number(process.env.DEGRADED_MULTIPLIER_CAP ?? '1.1')
const BASE_DEGRADE_ABUSE_COUNTER_THRESHOLD = Number(process.env.DEGRADE_ABUSE_COUNTER_THRESHOLD ?? '3')

const MATCHMAKER_MODES: MatchmakerMode[] = ['random', 'weak_anti_repeat', 'strong_anti_repeat']
const SABOTAGE_MODES: SabotageMode[] = ['none', 'false_flag_poisoning', 'telemetry_degradation']
const COALITION_SIZES: Array<2 | 3 | 5> = [2, 3, 5]

const POPULATIONS: PopulationProfile[] = [
  { honestAdaptive: 60, scriptedExploiters: 30, colluders: 10 },
  { honestAdaptive: 45, scriptedExploiters: 35, colluders: 20 },
  { honestAdaptive: 30, scriptedExploiters: 50, colluders: 20 },
]

function assertPositiveInt(name: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`invalid ${name}: expected positive integer, got ${value}`)
  }
}

function assertPositiveNumber(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`invalid ${name}: expected positive number, got ${value}`)
  }
}

function assertRatio(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`invalid ${name}: expected ratio in (0,1], got ${value}`)
  }
}

function makeScenarioId(
  coalitionSize: number,
  populationIdx: number,
  matchmaker: MatchmakerMode,
  sabotage: SabotageMode,
): string {
  return `coalition-${coalitionSize}__pop-${populationIdx + 1}__${matchmaker}__sabotage-${sabotage}`
}

function degradedModePolicyFor(sabotage: SabotageMode): DegradedModePolicy {
  if (sabotage === 'none') {
    return {
      payoutCapRatio: 1,
      multiplierCap: 1.2,
      degradeAbuseCounterThreshold: BASE_DEGRADE_ABUSE_COUNTER_THRESHOLD,
    }
  }

  if (sabotage === 'false_flag_poisoning') {
    return {
      payoutCapRatio: BASE_DEGRADED_PAYOUT_CAP_RATIO,
      multiplierCap: BASE_DEGRADED_MULTIPLIER_CAP,
      degradeAbuseCounterThreshold: BASE_DEGRADE_ABUSE_COUNTER_THRESHOLD,
    }
  }

  return {
    payoutCapRatio: Math.max(0.4, BASE_DEGRADED_PAYOUT_CAP_RATIO - 0.1),
    multiplierCap: Math.max(1, BASE_DEGRADED_MULTIPLIER_CAP - 0.05),
    degradeAbuseCounterThreshold: Math.max(1, BASE_DEGRADE_ABUSE_COUNTER_THRESHOLD - 1),
  }
}

function buildScenarios(): Scenario[] {
  const scenarios: Scenario[] = []

  for (const coalitionSize of COALITION_SIZES) {
    for (const [populationIdx, population] of POPULATIONS.entries()) {
      for (const matchmaker of MATCHMAKER_MODES) {
        for (const sabotage of SABOTAGE_MODES) {
          scenarios.push({
            id: makeScenarioId(coalitionSize, populationIdx, matchmaker, sabotage),
            coalitionSize,
            population,
            matchmaker,
            sabotage,
            degradedModePolicy: degradedModePolicyFor(sabotage),
            epochs: EPOCHS,
            battlesPerEpoch: BATTLES_PER_EPOCH,
            trackedOutputs: [
              'collusion_multiplier_leakage',
              'coalition_ev_delta_vs_honest_baseline',
              'same-opponent-pairing-rate',
              'newcomer_survival_rate',
              'sabotage_false_positive_rate',
              'telemetry_health_degradation_impact',
              'degraded_mode_cap_enforcement_rate',
              'degrade_abuse_counter_trigger_rate',
            ],
            acceptanceChecks: [
              'abnormal EV for collusion profiles <= configured tolerance',
              'multiplier leakage remains bounded under all matchmaker modes',
              'fairness metrics emitted for every scenario',
              'sabotage scenarios produce separate EV/fairness deltas',
              'degraded-mode payout/multiplier caps applied when sabotage mode is active',
            ],
          })
        }
      }
    }
  }

  return scenarios
}

function summarize(scenarios: Scenario[]): ScaffoldArtifact['scenarioCounts'] {
  const byCoalition: Record<string, number> = {}
  const byMatchmaker: Record<MatchmakerMode, number> = {
    random: 0,
    weak_anti_repeat: 0,
    strong_anti_repeat: 0,
  }
  const bySabotage: Record<SabotageMode, number> = {
    none: 0,
    false_flag_poisoning: 0,
    telemetry_degradation: 0,
  }

  for (const scenario of scenarios) {
    byCoalition[String(scenario.coalitionSize)] = (byCoalition[String(scenario.coalitionSize)] ?? 0) + 1
    byMatchmaker[scenario.matchmaker] += 1
    bySabotage[scenario.sabotage] += 1
  }

  return {
    total: scenarios.length,
    byCoalition,
    byMatchmaker,
    bySabotage,
  }
}

function main() {
  assertPositiveInt('COLLUSION_EPOCHS', EPOCHS)
  assertPositiveInt('COLLUSION_BATTLES_PER_EPOCH', BATTLES_PER_EPOCH)
  assertRatio('DEGRADED_PAYOUT_CAP_RATIO', BASE_DEGRADED_PAYOUT_CAP_RATIO)
  assertPositiveNumber('DEGRADED_MULTIPLIER_CAP', BASE_DEGRADED_MULTIPLIER_CAP)
  assertPositiveInt('DEGRADE_ABUSE_COUNTER_THRESHOLD', BASE_DEGRADE_ABUSE_COUNTER_THRESHOLD)

  const scenarios = buildScenarios()
  const out: ScaffoldArtifact = {
    generatedAt: new Date().toISOString(),
    purpose: 'P0 collusion-ring simulation matrix scaffold for dynamic reward + fixed penalty hardening',
    status: 'scaffold',
    assumptions: {
      rewardModel: 'dynamic reward multiplier based on verified-quality streak',
      penaltyModel: 'fixed penalty constants',
      qualityGateModel: 'heuristic gate (to be stress-tested with drift alarms)',
      degradedModePolicy: {
        payoutCapRatio: BASE_DEGRADED_PAYOUT_CAP_RATIO,
        multiplierCap: BASE_DEGRADED_MULTIPLIER_CAP,
        degradeAbuseCounterThreshold: BASE_DEGRADE_ABUSE_COUNTER_THRESHOLD,
      },
    },
    scenarioCounts: summarize(scenarios),
    scenarios,
    nextImplementationSteps: [
      'Wire scenario runner to actual battle simulation engine',
      'Emit fairness/concentration metric pack alongside EV outputs',
      'Attach alarm-threshold evaluator for heuristic-gaming drift checks',
    ],
  }

  const outDir = join(process.cwd(), '..', '..', 'memory', 'metrics')
  mkdirSync(outDir, { recursive: true })
  const filename = `collusion-matrix-scaffold-${new Date().toISOString().slice(0, 10)}.json`
  const outPath = join(outDir, filename)
  writeFileSync(outPath, JSON.stringify(out, null, 2))

  console.log(outPath)
  console.log(JSON.stringify(out.scenarioCounts, null, 2))
}

main()
