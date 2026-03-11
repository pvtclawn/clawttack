import { createHash } from 'node:crypto'

export type TimeoutSafetyPriorityTask1Reason =
  | 'timeout-safety-priority-pass'
  | 'timeout-safety-risk-score-invalid'
  | 'timeout-safety-confidence-inflated'

export interface TimeoutSafetyConfidenceSource {
  sourceId: string
  correlationGroup: string
  contribution: number
}

export interface TimeoutSafetyPriorityTask1Input {
  riskScore: number
  riskScoreProvenanceValid: boolean
  confidenceScore: number
  confidenceInflationTolerance: number
  confidenceSources: TimeoutSafetyConfidenceSource[]
}

export interface TimeoutSafetyPriorityTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutSafetyPriorityTask1Reason
  deduplicatedConfidenceScore: number
  confidenceInflationDelta: number
  artifactHash: `0x${string}`
}

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(String(value))
}

const sha256 = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const normalize = (value: string): string => value.trim().toLowerCase()

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export const evaluateTimeoutSafetyPriorityTask1 = (
  input: TimeoutSafetyPriorityTask1Input,
): TimeoutSafetyPriorityTask1Result => {
  const normalizedSources = input.confidenceSources.map((source) => ({
    sourceId: normalize(source.sourceId),
    correlationGroup: normalize(source.correlationGroup),
    contribution: clamp01(source.contribution),
  }))

  const maxByGroup = new Map<string, number>()
  for (const source of normalizedSources) {
    const current = maxByGroup.get(source.correlationGroup) ?? 0
    if (source.contribution > current) {
      maxByGroup.set(source.correlationGroup, source.contribution)
    }
  }

  const deduplicatedConfidenceScore = clamp01(
    [...maxByGroup.values()].reduce((sum, contribution) => sum + contribution, 0),
  )

  const confidenceInflationDelta = input.confidenceScore - deduplicatedConfidenceScore

  const payload = {
    riskScore: input.riskScore,
    riskScoreProvenanceValid: input.riskScoreProvenanceValid,
    confidenceScore: input.confidenceScore,
    confidenceInflationTolerance: input.confidenceInflationTolerance,
    confidenceSources: normalizedSources,
    deduplicatedConfidenceScore,
    confidenceInflationDelta,
  }

  if (
    !input.riskScoreProvenanceValid ||
    Number.isNaN(input.riskScore) ||
    input.riskScore < 0 ||
    input.riskScore > 1
  ) {
    return {
      verdict: 'fail',
      reason: 'timeout-safety-risk-score-invalid',
      deduplicatedConfidenceScore,
      confidenceInflationDelta,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-safety-risk-score-invalid' }),
    }
  }

  if (confidenceInflationDelta > input.confidenceInflationTolerance) {
    return {
      verdict: 'fail',
      reason: 'timeout-safety-confidence-inflated',
      deduplicatedConfidenceScore,
      confidenceInflationDelta,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-safety-confidence-inflated' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-safety-priority-pass',
    deduplicatedConfidenceScore,
    confidenceInflationDelta,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-safety-priority-pass' }),
  }
}
