import { createHash } from 'node:crypto'

export interface OodSuiteMetrics {
  passRate: number
  rejectPrecision: number
  liveness: number
  composite: number
}

export interface OodGateThresholds {
  version: string
  holdoutMinPassRate: number
  holdoutMinRejectPrecision: number
  holdoutMinLiveness: number
  maxGeneralizationGap: number
  minTrainComposite: number
}

export type OodGateReason =
  | 'pass'
  | 'holdout-floor-fail'
  | 'gap-too-large'
  | 'train-regression'
  | 'threshold-version-mismatch'

export interface OodGateInput {
  trainMetrics: OodSuiteMetrics
  holdoutMetrics: OodSuiteMetrics
  thresholds: OodGateThresholds
  /** Optional immutable lock from prior run artifact. */
  expectedThresholdVersion?: string
  /** Optional immutable lock hash from prior run artifact. */
  expectedThresholdHash?: `0x${string}`
  /** Optional train composite baseline to detect regression. */
  previousTrainComposite?: number
}

export interface OodGateResult {
  verdict: 'pass' | 'fail'
  reason: OodGateReason
  thresholdVersion: string
  thresholdHash: `0x${string}`
  generalizationGap: number
  floorChecks: {
    holdoutPassRate: boolean
    holdoutRejectPrecision: boolean
    holdoutLiveness: boolean
  }
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

const validateThresholds = (thresholds: OodGateThresholds): void => {
  if (!thresholds.version || thresholds.version.trim().length === 0) {
    throw new Error('invalid-threshold-version')
  }
  if (!Number.isFinite(thresholds.maxGeneralizationGap) || thresholds.maxGeneralizationGap < 0) {
    throw new Error('invalid-max-generalization-gap')
  }
}

export const computeOodThresholdHash = (thresholds: OodGateThresholds): `0x${string}` => {
  validateThresholds(thresholds)
  const digest = createHash('sha256').update(stableStringify(thresholds)).digest('hex')
  return `0x${digest}`
}

/**
 * Deterministic simulation-only OOD gate with per-metric floors + immutable threshold bindings.
 */
export const evaluateOodGate = (input: OodGateInput): OodGateResult => {
  const thresholdHash = computeOodThresholdHash(input.thresholds)
  const thresholdVersion = input.thresholds.version

  if (input.expectedThresholdVersion && input.expectedThresholdVersion !== thresholdVersion) {
    return {
      verdict: 'fail',
      reason: 'threshold-version-mismatch',
      thresholdVersion,
      thresholdHash,
      generalizationGap: 0,
      floorChecks: {
        holdoutPassRate: false,
        holdoutRejectPrecision: false,
        holdoutLiveness: false,
      },
    }
  }

  if (input.expectedThresholdHash && input.expectedThresholdHash !== thresholdHash) {
    return {
      verdict: 'fail',
      reason: 'threshold-version-mismatch',
      thresholdVersion,
      thresholdHash,
      generalizationGap: 0,
      floorChecks: {
        holdoutPassRate: false,
        holdoutRejectPrecision: false,
        holdoutLiveness: false,
      },
    }
  }

  const trainComposite = clamp01(input.trainMetrics.composite)
  const holdoutComposite = clamp01(input.holdoutMetrics.composite)

  if (
    input.previousTrainComposite != null &&
    Number.isFinite(input.previousTrainComposite) &&
    trainComposite < clamp01(input.previousTrainComposite)
  ) {
    return {
      verdict: 'fail',
      reason: 'train-regression',
      thresholdVersion,
      thresholdHash,
      generalizationGap: trainComposite - holdoutComposite,
      floorChecks: {
        holdoutPassRate: false,
        holdoutRejectPrecision: false,
        holdoutLiveness: false,
      },
    }
  }

  const floorChecks = {
    holdoutPassRate: clamp01(input.holdoutMetrics.passRate) >= clamp01(input.thresholds.holdoutMinPassRate),
    holdoutRejectPrecision:
      clamp01(input.holdoutMetrics.rejectPrecision) >=
      clamp01(input.thresholds.holdoutMinRejectPrecision),
    holdoutLiveness: clamp01(input.holdoutMetrics.liveness) >= clamp01(input.thresholds.holdoutMinLiveness),
  }

  if (!floorChecks.holdoutPassRate || !floorChecks.holdoutRejectPrecision || !floorChecks.holdoutLiveness) {
    return {
      verdict: 'fail',
      reason: 'holdout-floor-fail',
      thresholdVersion,
      thresholdHash,
      generalizationGap: trainComposite - holdoutComposite,
      floorChecks,
    }
  }

  if (trainComposite < clamp01(input.thresholds.minTrainComposite)) {
    return {
      verdict: 'fail',
      reason: 'train-regression',
      thresholdVersion,
      thresholdHash,
      generalizationGap: trainComposite - holdoutComposite,
      floorChecks,
    }
  }

  const generalizationGap = trainComposite - holdoutComposite
  if (generalizationGap > input.thresholds.maxGeneralizationGap) {
    return {
      verdict: 'fail',
      reason: 'gap-too-large',
      thresholdVersion,
      thresholdHash,
      generalizationGap,
      floorChecks,
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    thresholdVersion,
    thresholdHash,
    generalizationGap,
    floorChecks,
  }
}
