import { createHash } from 'node:crypto'

export type TimeoutLogicalOrderNormalizationTask1Reason =
  | 'timeout-logical-order-normalized'
  | 'timeout-logical-bucket-poisoned'
  | 'timeout-logical-tiebreak-invalid'

export interface TimeoutLogicalOrderEvent {
  eventId: string
  bucketId: string
  critical: boolean
  tieBreakKey: string
}

export interface TimeoutLogicalOrderNormalizationTask1Input {
  operationId: string
  maxNonCriticalInCriticalBucket: number
  events: TimeoutLogicalOrderEvent[]
}

export interface TimeoutLogicalOrderNormalizationTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutLogicalOrderNormalizationTask1Reason
  poisonedBucketIds: string[]
  invalidTieBreakEventIds: string[]
  normalizedBuckets: Record<string, string[]>
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

const normalizeId = (value: string): string => value.trim().toLowerCase()

const isCanonicalTieBreak = (value: string): boolean => /^[a-z0-9][a-z0-9:_-]{1,63}$/.test(value)

export const evaluateTimeoutLogicalOrderNormalizationTask1 = (
  input: TimeoutLogicalOrderNormalizationTask1Input,
): TimeoutLogicalOrderNormalizationTask1Result => {
  const operationId = normalizeId(input.operationId)
  const normalizedEvents = input.events.map((event) => ({
    eventId: normalizeId(event.eventId),
    bucketId: normalizeId(event.bucketId),
    critical: event.critical,
    tieBreakKey: normalizeId(event.tieBreakKey),
  }))

  const invalidTieBreakEventIds = normalizedEvents
    .filter((event) => !isCanonicalTieBreak(event.tieBreakKey) || event.tieBreakKey !== event.eventId)
    .map((event) => event.eventId)
    .sort((a, b) => a.localeCompare(b))

  const grouped = new Map<string, typeof normalizedEvents>()
  for (const event of normalizedEvents) {
    const list = grouped.get(event.bucketId) ?? []
    list.push(event)
    grouped.set(event.bucketId, list)
  }

  const normalizedBuckets: Record<string, string[]> = {}
  const poisonedBucketIds: string[] = []

  for (const [bucketId, list] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ordered = [...list].sort((a, b) => a.tieBreakKey.localeCompare(b.tieBreakKey))
    normalizedBuckets[bucketId] = ordered.map((event) => event.eventId)

    const criticalCount = ordered.filter((event) => event.critical).length
    const nonCriticalCount = ordered.length - criticalCount
    const hasCritical = criticalCount > 0
    const firstNonCriticalIndex = ordered.findIndex((event) => !event.critical)
    const firstCriticalIndex = ordered.findIndex((event) => event.critical)

    const criticalPrecedenceBroken =
      hasCritical && firstNonCriticalIndex !== -1 && firstCriticalIndex !== -1 && firstNonCriticalIndex < firstCriticalIndex

    if (
      (hasCritical && nonCriticalCount > input.maxNonCriticalInCriticalBucket) ||
      criticalPrecedenceBroken
    ) {
      poisonedBucketIds.push(bucketId)
    }
  }

  poisonedBucketIds.sort((a, b) => a.localeCompare(b))

  const payload = {
    operationId,
    maxNonCriticalInCriticalBucket: input.maxNonCriticalInCriticalBucket,
    events: normalizedEvents,
    invalidTieBreakEventIds,
    poisonedBucketIds,
    normalizedBuckets,
  }

  if (invalidTieBreakEventIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-logical-tiebreak-invalid',
      poisonedBucketIds,
      invalidTieBreakEventIds,
      normalizedBuckets,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-logical-tiebreak-invalid' }),
    }
  }

  if (poisonedBucketIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-logical-bucket-poisoned',
      poisonedBucketIds,
      invalidTieBreakEventIds,
      normalizedBuckets,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-logical-bucket-poisoned' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-logical-order-normalized',
    poisonedBucketIds,
    invalidTieBreakEventIds,
    normalizedBuckets,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-logical-order-normalized' }),
  }
}
