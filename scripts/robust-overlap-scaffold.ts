#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

type SabotageMode = 'none' | 'false_flag_poisoning' | 'telemetry_degradation'

type SweepCell = {
  id: string
  mode: SabotageMode
  deltas: {
    colluderEvDelta: number
    honestRetentionDelta: number
  }
}

type SweepArtifact = {
  generatedAt: string
  cellCount: number
  cells: SweepCell[]
}

type PerturbationVariant = {
  id: string
  description: string
  includeModes: SabotageMode[]
  evWeight: number
  retentionWeight: number
}

type DecisionTraceEntry = {
  ruleId: 'hard_floor_baseline_overlap' | 'worst_case_variant_floor' | 'normalized_overlap_threshold' | 'raw_overlap_diagnostic'
  gateIntent: 'safety_gate' | 'liveness_gate' | 'diagnostic'
  order: number
  pass: boolean
  stopOnFail: boolean
  value: number
  threshold: number
  comparator: '>=' | 'diagnostic'
  reason: string
}

type RobustOverlapArtifact = {
  generatedAt: string
  status: 'scaffold'
  precedencePolicyVersion: string
  finalVerdictReason: string
  sourceSweepArtifact: string
  baseline: {
    modeSafeCounts: Record<SabotageMode, number>
    overlapCount: number
    overlapRatio: number
  }
  perturbations: Array<{
    id: string
    description: string
    modeSafeCounts: Record<SabotageMode, number>
    overlapCount: number
    overlapRatio: number
    weightedOverlapScore: number
  }>
  robustnessAdjustedOverlapScore: number
  worstVariant: {
    id: string
    weightedOverlapScore: number
  }
  decisionTrace: DecisionTraceEntry[]
  acceptance: {
    threshold: number
    worstVariantFloor: number
    baselineHardFloor: number
    normalizedPass: boolean
    worstVariantPass: boolean
    hardFloorPass: boolean
    pass: boolean
  }
  nextImplementationSteps: string[]
}

const SWEEP_PATH = process.env.SWEEP_ARTIFACT_PATH
  ?? join(process.cwd(), '..', '..', 'memory', 'metrics', `degraded-policy-sweep-scaffold-${new Date().toISOString().slice(0,10)}.json`)
const OVERLAP_THRESHOLD = Number(process.env.ROBUST_OVERLAP_THRESHOLD ?? '0.08')
const WORST_VARIANT_FLOOR = Number(process.env.ROBUST_WORST_VARIANT_FLOOR ?? '0.05')
const BASELINE_HARD_FLOOR = Number(process.env.ROBUST_BASELINE_HARD_FLOOR ?? '0.05')

const MODES: SabotageMode[] = ['none', 'false_flag_poisoning', 'telemetry_degradation']

const PERTURBATIONS: PerturbationVariant[] = [
  {
    id: 'pop-mix-colluder-heavy',
    description: 'Higher colluder/script prevalence stress',
    includeModes: MODES,
    evWeight: 1.2,
    retentionWeight: 1,
  },
  {
    id: 'matchmaker-anti-repeat-weak',
    description: 'Less protective matching regime stress',
    includeModes: MODES,
    evWeight: 1.1,
    retentionWeight: 1,
  },
  {
    id: 'telemetry-stress',
    description: 'Telemetry degradation dominant regime',
    includeModes: ['telemetry_degradation'],
    evWeight: 1.3,
    retentionWeight: 0.9,
  },
]

function loadSweep(path: string): SweepArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as SweepArtifact
}

function isSafe(cell: SweepCell, evWeight = 1, retentionWeight = 1): boolean {
  const ev = cell.deltas.colluderEvDelta * evWeight
  const retention = cell.deltas.honestRetentionDelta * retentionWeight
  return ev < 0 && retention > 0
}

function modeSafeSets(cells: SweepCell[], includeModes: SabotageMode[], evWeight = 1, retentionWeight = 1): Record<SabotageMode, Set<string>> {
  const out: Record<SabotageMode, Set<string>> = {
    none: new Set<string>(),
    false_flag_poisoning: new Set<string>(),
    telemetry_degradation: new Set<string>(),
  }

  for (const mode of includeModes) {
    const filtered = cells.filter((c) => c.mode === mode && isSafe(c, evWeight, retentionWeight))
    for (const cell of filtered) {
      const baseKey = cell.id.split('__')[1] + '__' + cell.id.split('__')[2] + '__' + cell.id.split('__')[3]
      out[mode].add(baseKey)
    }
  }

  return out
}

function overlapCount(sets: Record<SabotageMode, Set<string>>, includeModes: SabotageMode[]): number {
  if (includeModes.length === 0) return 0
  const [first, ...rest] = includeModes
  const firstSet = sets[first]
  let count = 0
  for (const k of firstSet) {
    if (rest.every((m) => sets[m].has(k))) count += 1
  }
  return count
}

function denominator(includeModes: SabotageMode[], sets: Record<SabotageMode, Set<string>>): number {
  return Math.max(1, ...includeModes.map((m) => sets[m].size))
}

function main() {
  if (!Number.isFinite(OVERLAP_THRESHOLD) || OVERLAP_THRESHOLD <= 0 || OVERLAP_THRESHOLD >= 1) {
    throw new Error(`invalid ROBUST_OVERLAP_THRESHOLD: ${OVERLAP_THRESHOLD}`)
  }
  if (!Number.isFinite(WORST_VARIANT_FLOOR) || WORST_VARIANT_FLOOR <= 0 || WORST_VARIANT_FLOOR >= 1) {
    throw new Error(`invalid ROBUST_WORST_VARIANT_FLOOR: ${WORST_VARIANT_FLOOR}`)
  }
  if (!Number.isFinite(BASELINE_HARD_FLOOR) || BASELINE_HARD_FLOOR <= 0 || BASELINE_HARD_FLOOR >= 1) {
    throw new Error(`invalid ROBUST_BASELINE_HARD_FLOOR: ${BASELINE_HARD_FLOOR}`)
  }

  const sweep = loadSweep(SWEEP_PATH)

  const baselineSets = modeSafeSets(sweep.cells, MODES)
  const baselineOverlapCount = overlapCount(baselineSets, MODES)
  const baselineOverlapRatio = baselineOverlapCount / denominator(MODES, baselineSets)

  const perturbationResults = PERTURBATIONS.map((p) => {
    const sets = modeSafeSets(sweep.cells, p.includeModes, p.evWeight, p.retentionWeight)
    const count = overlapCount(sets, p.includeModes)
    const ratio = count / denominator(p.includeModes, sets)

    return {
      id: p.id,
      description: p.description,
      modeSafeCounts: {
        none: sets.none.size,
        false_flag_poisoning: sets.false_flag_poisoning.size,
        telemetry_degradation: sets.telemetry_degradation.size,
      },
      overlapCount: count,
      overlapRatio: Number(ratio.toFixed(4)),
      weightedOverlapScore: Number((ratio * (p.evWeight + p.retentionWeight) / 2).toFixed(4)),
    }
  })

  const robustnessAdjustedOverlapScore = Number((
    perturbationResults.reduce((acc, p) => acc + p.weightedOverlapScore, 0) / Math.max(1, perturbationResults.length)
  ).toFixed(4))

  const worstVariant = perturbationResults.reduce((worst, current) => (
    current.weightedOverlapScore < worst.weightedOverlapScore ? current : worst
  ))

  const hardFloorPass = baselineOverlapRatio >= BASELINE_HARD_FLOOR
  const normalizedPass = robustnessAdjustedOverlapScore >= OVERLAP_THRESHOLD
  const worstVariantPass = worstVariant.weightedOverlapScore >= WORST_VARIANT_FLOOR

  const decisionTrace: DecisionTraceEntry[] = [
    {
      ruleId: 'hard_floor_baseline_overlap',
      gateIntent: 'safety_gate',
      order: 1,
      pass: hardFloorPass,
      stopOnFail: true,
      value: Number(baselineOverlapRatio.toFixed(4)),
      threshold: BASELINE_HARD_FLOOR,
      comparator: '>=',
      reason: 'Safety floor on baseline overlap before perturbation aggregation',
    },
    {
      ruleId: 'worst_case_variant_floor',
      gateIntent: 'safety_gate',
      order: 2,
      pass: worstVariantPass,
      stopOnFail: true,
      value: worstVariant.weightedOverlapScore,
      threshold: WORST_VARIANT_FLOOR,
      comparator: '>=',
      reason: 'Safety gate on weakest perturbation variant',
    },
    {
      ruleId: 'normalized_overlap_threshold',
      gateIntent: 'liveness_gate',
      order: 3,
      pass: normalizedPass,
      stopOnFail: true,
      value: robustnessAdjustedOverlapScore,
      threshold: OVERLAP_THRESHOLD,
      comparator: '>=',
      reason: 'Performance/liveness aggregate after safety gates pass',
    },
    {
      ruleId: 'raw_overlap_diagnostic',
      gateIntent: 'diagnostic',
      order: 4,
      pass: true,
      stopOnFail: false,
      value: Number(baselineOverlapRatio.toFixed(4)),
      threshold: Number(baselineOverlapRatio.toFixed(4)),
      comparator: 'diagnostic',
      reason: 'Diagnostic-only raw baseline overlap signal',
    },
  ]

  const firstHardFailure = decisionTrace.find((entry) => entry.stopOnFail && !entry.pass)
  const finalVerdictReason = firstHardFailure?.ruleId ?? 'all_hard_rules_passed'

  const out: RobustOverlapArtifact = {
    generatedAt: new Date().toISOString(),
    status: 'scaffold',
    precedencePolicyVersion: 'v1-hardstop-ordered-gates',
    finalVerdictReason,
    sourceSweepArtifact: SWEEP_PATH,
    baseline: {
      modeSafeCounts: {
        none: baselineSets.none.size,
        false_flag_poisoning: baselineSets.false_flag_poisoning.size,
        telemetry_degradation: baselineSets.telemetry_degradation.size,
      },
      overlapCount: baselineOverlapCount,
      overlapRatio: Number(baselineOverlapRatio.toFixed(4)),
    },
    perturbations: perturbationResults,
    robustnessAdjustedOverlapScore,
    worstVariant: {
      id: worstVariant.id,
      weightedOverlapScore: worstVariant.weightedOverlapScore,
    },
    decisionTrace,
    acceptance: {
      threshold: OVERLAP_THRESHOLD,
      worstVariantFloor: WORST_VARIANT_FLOOR,
      baselineHardFloor: BASELINE_HARD_FLOOR,
      hardFloorPass,
      normalizedPass,
      worstVariantPass,
      pass: firstHardFailure === undefined,
    },
    nextImplementationSteps: [
      'Replace heuristic safe-cell criteria with simulation-engine metric gates',
      'Attach subgroup guardrails and directional instability filter',
      'Use robust-overlap score as go/no-go input for global default selection',
    ],
  }

  const outDir = join(process.cwd(), '..', '..', 'memory', 'metrics')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `robust-overlap-scaffold-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(outPath, JSON.stringify(out, null, 2))

  console.log(outPath)
  console.log(JSON.stringify({ baseline: out.baseline, robustnessAdjustedOverlapScore, acceptance: out.acceptance }, null, 2))
}

main()
