import { createHash } from 'node:crypto'

export type TimeoutProbeClass = 'rpc' | 'tx-receipt' | 'state-read' | 'indexer' | 'mempool'
export type TimeoutProbeOutcome = 'failure' | 'uncertain' | 'success'

export type BatchRunnerTimeoutSuspicionTask1Reason =
  | 'runner-timeout-suspect'
  | 'runner-timeout-confirmed-failure'
  | 'runner-timeout-confirmation-correlation-risk'

export interface TimeoutProbeObservation {
  probeClass: TimeoutProbeClass
  providerId: string
  correlationGroup: string
  outcome: TimeoutProbeOutcome
}

export interface BatchRunnerTimeoutSuspicionTask1Input {
  operationId: string
  retryCount: number
  requiredFailureProbeCount: number
  requiredDistinctCorrelationGroups: number
  observations: TimeoutProbeObservation[]
}

export interface BatchRunnerTimeoutSuspicionTask1Result {
  verdict: 'pass' | 'fail' | 'suspect'
  reason: BatchRunnerTimeoutSuspicionTask1Reason
  failureProbeCount: number
  distinctFailureCorrelationGroups: number
  hasAnySuccessSignal: boolean
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

const normalizeObservation = (observation: TimeoutProbeObservation): TimeoutProbeObservation => ({
  probeClass: observation.probeClass,
  providerId: observation.providerId.trim().toLowerCase(),
  correlationGroup: observation.correlationGroup.trim().toLowerCase(),
  outcome: observation.outcome,
})

export const evaluateBatchRunnerTimeoutSuspicionTask1 = (
  input: BatchRunnerTimeoutSuspicionTask1Input,
): BatchRunnerTimeoutSuspicionTask1Result => {
  const normalizedObservations = input.observations.map((observation) => normalizeObservation(observation))
  const failureObservations = normalizedObservations.filter((observation) => observation.outcome === 'failure')
  const distinctFailureCorrelationGroups = new Set(
    failureObservations.map((observation) => observation.correlationGroup),
  ).size
  const hasAnySuccessSignal = normalizedObservations.some((observation) => observation.outcome === 'success')

  const payload = {
    operationId: input.operationId,
    retryCount: input.retryCount,
    requiredFailureProbeCount: input.requiredFailureProbeCount,
    requiredDistinctCorrelationGroups: input.requiredDistinctCorrelationGroups,
    observations: normalizedObservations,
    failureProbeCount: failureObservations.length,
    distinctFailureCorrelationGroups,
    hasAnySuccessSignal,
  }

  if (
    failureObservations.length >= input.requiredFailureProbeCount &&
    distinctFailureCorrelationGroups < input.requiredDistinctCorrelationGroups
  ) {
    return {
      verdict: 'fail',
      reason: 'runner-timeout-confirmation-correlation-risk',
      failureProbeCount: failureObservations.length,
      distinctFailureCorrelationGroups,
      hasAnySuccessSignal,
      artifactHash: sha256({
        ...payload,
        verdict: 'fail',
        reason: 'runner-timeout-confirmation-correlation-risk',
      }),
    }
  }

  if (
    failureObservations.length >= input.requiredFailureProbeCount &&
    distinctFailureCorrelationGroups >= input.requiredDistinctCorrelationGroups &&
    !hasAnySuccessSignal
  ) {
    return {
      verdict: 'pass',
      reason: 'runner-timeout-confirmed-failure',
      failureProbeCount: failureObservations.length,
      distinctFailureCorrelationGroups,
      hasAnySuccessSignal,
      artifactHash: sha256({
        ...payload,
        verdict: 'pass',
        reason: 'runner-timeout-confirmed-failure',
      }),
    }
  }

  return {
    verdict: 'suspect',
    reason: 'runner-timeout-suspect',
    failureProbeCount: failureObservations.length,
    distinctFailureCorrelationGroups,
    hasAnySuccessSignal,
    artifactHash: sha256({
      ...payload,
      verdict: 'suspect',
      reason: 'runner-timeout-suspect',
    }),
  }
}
