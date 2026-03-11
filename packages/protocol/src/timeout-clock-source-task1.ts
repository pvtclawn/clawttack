import { createHash } from 'node:crypto'

export type TimeoutClockSourceClass = 'monotonic' | 'wall-clock'

export type TimeoutClockSourceTask1Reason =
  | 'timeout-clock-source-pass'
  | 'timeout-clock-source-provenance-invalid'
  | 'timeout-clock-source-mixed-ordering-invalid'

export interface TimeoutClockObservation {
  nodeId: string
  sourceClass: TimeoutClockSourceClass
  provenanceValid: boolean
  monotonicTick: number
  wallClockUnixMs: number
}

export interface TimeoutClockSourceTask1Input {
  expectedNodeId: string
  observations: TimeoutClockObservation[]
}

export interface TimeoutClockSourceTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutClockSourceTask1Reason
  invalidProvenanceIndexes: number[]
  mixedSourceOrdering: boolean
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

const normalizeNodeId = (value: string): string => value.trim().toLowerCase()

export const evaluateTimeoutClockSourceTask1 = (
  input: TimeoutClockSourceTask1Input,
): TimeoutClockSourceTask1Result => {
  const expectedNodeId = normalizeNodeId(input.expectedNodeId)

  const invalidProvenanceIndexes = input.observations
    .map((observation, idx) => ({ observation, idx }))
    .filter(({ observation }) => {
      const sameExpectedNode = normalizeNodeId(observation.nodeId) === expectedNodeId
      return !observation.provenanceValid || !sameExpectedNode
    })
    .map(({ idx }) => idx)

  const distinctSourceClasses = new Set(input.observations.map((observation) => observation.sourceClass))
  const mixedSourceOrdering = distinctSourceClasses.size > 1

  const payload = {
    input,
    expectedNodeId,
    invalidProvenanceIndexes,
    mixedSourceOrdering,
  }

  if (invalidProvenanceIndexes.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-clock-source-provenance-invalid',
      invalidProvenanceIndexes,
      mixedSourceOrdering,
      artifactHash: sha256({
        ...payload,
        verdict: 'fail',
        reason: 'timeout-clock-source-provenance-invalid',
      }),
    }
  }

  if (mixedSourceOrdering) {
    return {
      verdict: 'fail',
      reason: 'timeout-clock-source-mixed-ordering-invalid',
      invalidProvenanceIndexes,
      mixedSourceOrdering,
      artifactHash: sha256({
        ...payload,
        verdict: 'fail',
        reason: 'timeout-clock-source-mixed-ordering-invalid',
      }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-clock-source-pass',
    invalidProvenanceIndexes,
    mixedSourceOrdering,
    artifactHash: sha256({
      ...payload,
      verdict: 'pass',
      reason: 'timeout-clock-source-pass',
    }),
  }
}
