export type FeatureProvenance = 'chain' | 'asserted' | 'missing'

export interface ConfidenceFeatureInput {
  /** Normalized feature in [0,1] where higher means better confidence quality. */
  value?: number | null
  provenance: FeatureProvenance
}

export interface ConfidenceInputs {
  /** Fraction of expected turns that were completed cleanly. */
  turnCompleteness: ConfidenceFeatureInput
  /** Timeout pressure in [0,1] where 1 is heavy timeout pressure (worse quality). */
  timeoutPressure: ConfidenceFeatureInput
  /** Replay/evidence integrity confidence in [0,1]. */
  replayIntegrity: ConfidenceFeatureInput
}

export interface ConfidenceGamingSignals {
  selfInducedUncertaintyEvents: number
  totalBattlesObserved: number
  repeatedMissingEvidenceEvents?: number
  ratioThreshold?: number
  minEvents?: number
}

export interface ConfidenceGamingDetection {
  suspicious: boolean
  ratio: number
  reasons: string[]
  penaltyMultiplier: number
}

export interface FeatureScore {
  name: 'turnCompleteness' | 'timeoutPressure' | 'replayIntegrity'
  inputProvenance: FeatureProvenance
  normalizedQuality: number
  provenancePenalty: number
  weightedContribution: number
  notes: string[]
}

export interface RiskAwareConfidenceResult {
  confidence: number
  baseConfidence: number
  featureScores: FeatureScore[]
  chainFeatureCount: number
  assertedFeatureCount: number
  missingFeatureCount: number
  gamingDetection: ConfidenceGamingDetection
  capsApplied: string[]
}

const CONFIDENCE_FLOOR = 0.4
const CONFIDENCE_CEIL = 1.0

const FEATURE_WEIGHTS = {
  turnCompleteness: 0.4,
  timeoutPressure: 0.3,
  replayIntegrity: 0.3,
} as const

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return CONFIDENCE_FLOOR
  if (value < CONFIDENCE_FLOOR) return CONFIDENCE_FLOOR
  if (value > CONFIDENCE_CEIL) return CONFIDENCE_CEIL
  return value
}

function provenancePenalty(provenance: FeatureProvenance): number {
  switch (provenance) {
    case 'chain':
      return 1
    case 'asserted':
      return 0.85
    case 'missing':
      return 0.7
  }
}

function normalizeQuality(
  featureName: FeatureScore['name'],
  input: ConfidenceFeatureInput,
): { quality: number; notes: string[] } {
  const notes: string[] = []

  if (input.provenance === 'missing') {
    notes.push('missing-evidence-fallback')
    return { quality: CONFIDENCE_FLOOR, notes }
  }

  if (input.value == null || !Number.isFinite(input.value)) {
    notes.push('invalid-value-fallback')
    return { quality: CONFIDENCE_FLOOR, notes }
  }

  const normalized = clamp01(input.value)

  if (featureName === 'timeoutPressure') {
    return { quality: 1 - normalized, notes }
  }

  return { quality: normalized, notes }
}

/**
 * Detector for repeated self-induced uncertainty patterns.
 * Simulation-only: no on-chain side effects.
 */
export function detectConfidenceGaming(
  signals: ConfidenceGamingSignals,
): ConfidenceGamingDetection {
  const total = Math.max(0, Math.floor(signals.totalBattlesObserved))
  const selfInduced = Math.max(0, Math.floor(signals.selfInducedUncertaintyEvents))
  const repeatedMissing = Math.max(0, Math.floor(signals.repeatedMissingEvidenceEvents ?? 0))
  const ratioThreshold = signals.ratioThreshold ?? 0.5
  const minEvents = signals.minEvents ?? 3

  const ratio = total > 0 ? selfInduced / total : 0
  const reasons: string[] = []

  if (selfInduced >= minEvents && ratio >= ratioThreshold) {
    reasons.push('self-induced-uncertainty-pattern')
  }

  if (repeatedMissing >= minEvents) {
    reasons.push('repeated-missing-evidence-pattern')
  }

  const suspicious = reasons.length > 0
  return {
    suspicious,
    ratio,
    reasons,
    penaltyMultiplier: suspicious ? 0.8 : 1,
  }
}

/**
 * Compute confidence scalar c in [0.4, 1.0] for risk-aware rating simulation.
 *
 * Guarantees:
 * - provenance is explicit per feature,
 * - missing/unverifiable evidence cannot increase confidence,
 * - suspicious repeated uncertainty patterns are penalized.
 */
export function computeRiskAwareConfidence(
  inputs: ConfidenceInputs,
  gamingSignals?: ConfidenceGamingSignals,
): RiskAwareConfidenceResult {
  const featureEntries: Array<[FeatureScore['name'], ConfidenceFeatureInput]> = [
    ['turnCompleteness', inputs.turnCompleteness],
    ['timeoutPressure', inputs.timeoutPressure],
    ['replayIntegrity', inputs.replayIntegrity],
  ]

  let chainFeatureCount = 0
  let assertedFeatureCount = 0
  let missingFeatureCount = 0

  const featureScores: FeatureScore[] = featureEntries.map(([name, input]) => {
    if (input.provenance === 'chain') chainFeatureCount += 1
    if (input.provenance === 'asserted') assertedFeatureCount += 1
    if (input.provenance === 'missing') missingFeatureCount += 1

    const normalized = normalizeQuality(name, input)
    const penalty = provenancePenalty(input.provenance)
    const weightedContribution =
      normalized.quality * penalty * FEATURE_WEIGHTS[name]

    return {
      name,
      inputProvenance: input.provenance,
      normalizedQuality: normalized.quality,
      provenancePenalty: penalty,
      weightedContribution,
      notes: normalized.notes,
    }
  })

  let baseConfidence = featureScores.reduce((sum, f) => sum + f.weightedContribution, 0)
  const capsApplied: string[] = []

  // Conservative cap: no chain evidence means confidence cannot be high.
  if (chainFeatureCount === 0) {
    baseConfidence = Math.min(baseConfidence, 0.65)
    capsApplied.push('no-chain-evidence-cap')
  }

  // Missing evidence must not inflate confidence.
  if (missingFeatureCount > 0) {
    baseConfidence = Math.min(baseConfidence, 0.8)
    capsApplied.push('missing-evidence-cap')
  }

  baseConfidence = clampConfidence(baseConfidence)

  const gamingDetection = gamingSignals
    ? detectConfidenceGaming(gamingSignals)
    : {
        suspicious: false,
        ratio: 0,
        reasons: [],
        penaltyMultiplier: 1,
      }

  const confidence = clampConfidence(baseConfidence * gamingDetection.penaltyMultiplier)

  return {
    confidence,
    baseConfidence,
    featureScores,
    chainFeatureCount,
    assertedFeatureCount,
    missingFeatureCount,
    gamingDetection,
    capsApplied,
  }
}
