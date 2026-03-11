import { createHash } from 'node:crypto'

export type TimeoutCausalOrderingTask1Reason =
  | 'timeout-causal-order-pass'
  | 'timeout-causal-edge-invalid'
  | 'timeout-causal-context-incomplete'

export interface TimeoutCausalEvent {
  eventId: string
  operationId: string
  dependsOn: string[]
  edgeAuthValid: boolean
}

export interface TimeoutCausalOrderingTask1Input {
  operationId: string
  requiredEventIds: string[]
  events: TimeoutCausalEvent[]
}

export interface TimeoutCausalOrderingTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutCausalOrderingTask1Reason
  invalidEdgeEventIds: string[]
  missingRequiredEventIds: string[]
  missingDependencyEventIds: string[]
  duplicateEventIds: string[]
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

export const evaluateTimeoutCausalOrderingTask1 = (
  input: TimeoutCausalOrderingTask1Input,
): TimeoutCausalOrderingTask1Result => {
  const operationId = normalizeId(input.operationId)
  const requiredEventIds = input.requiredEventIds.map((id) => normalizeId(id)).sort((a, b) => a.localeCompare(b))
  const normalizedEvents = input.events.map((event) => ({
    eventId: normalizeId(event.eventId),
    operationId: normalizeId(event.operationId),
    dependsOn: event.dependsOn.map((id) => normalizeId(id)).sort((a, b) => a.localeCompare(b)),
    edgeAuthValid: event.edgeAuthValid,
  }))

  const counts = new Map<string, number>()
  for (const event of normalizedEvents) {
    counts.set(event.eventId, (counts.get(event.eventId) ?? 0) + 1)
  }

  const duplicateEventIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([eventId]) => eventId)
    .sort((a, b) => a.localeCompare(b))

  const eventSet = new Set(normalizedEvents.map((event) => event.eventId))

  const invalidEdgeEventIds = normalizedEvents
    .filter((event) => !event.edgeAuthValid || event.operationId !== operationId)
    .map((event) => event.eventId)
    .sort((a, b) => a.localeCompare(b))

  const missingRequiredEventIds = requiredEventIds
    .filter((requiredId) => !eventSet.has(requiredId))
    .sort((a, b) => a.localeCompare(b))

  const missingDependencyEventIds = [...new Set(normalizedEvents.flatMap((event) => event.dependsOn))]
    .filter((dependencyId) => !eventSet.has(dependencyId))
    .sort((a, b) => a.localeCompare(b))

  const payload = {
    operationId,
    requiredEventIds,
    events: normalizedEvents,
    invalidEdgeEventIds,
    missingRequiredEventIds,
    missingDependencyEventIds,
    duplicateEventIds,
  }

  if (invalidEdgeEventIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-causal-edge-invalid',
      invalidEdgeEventIds,
      missingRequiredEventIds,
      missingDependencyEventIds,
      duplicateEventIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-causal-edge-invalid' }),
    }
  }

  if (missingRequiredEventIds.length > 0 || missingDependencyEventIds.length > 0 || duplicateEventIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-causal-context-incomplete',
      invalidEdgeEventIds,
      missingRequiredEventIds,
      missingDependencyEventIds,
      duplicateEventIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-causal-context-incomplete' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-causal-order-pass',
    invalidEdgeEventIds,
    missingRequiredEventIds,
    missingDependencyEventIds,
    duplicateEventIds,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-causal-order-pass' }),
  }
}
