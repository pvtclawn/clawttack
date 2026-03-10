import { createHash } from 'node:crypto'

export type DeliverySemanticsTask1Reason =
  | 'delivery-semantics-pass'
  | 'delivery-duplicate-storm'
  | 'delivery-semantic-reorder-violation'

export interface DeliveryEnvelopeEvent {
  envelopeId: string
  semanticStep: number
  receivedOrder: number
}

export interface VerificationClaimDeliverySemanticsTask1Input {
  duplicateCountInWindow: number
  duplicateStormThreshold: number
  semanticReorderViolations: number
  semanticReorderThreshold: number
  events: DeliveryEnvelopeEvent[]
}

export interface VerificationClaimDeliverySemanticsTask1Result {
  verdict: 'pass' | 'fail'
  reason: DeliverySemanticsTask1Reason
  duplicateStormDetected: boolean
  semanticReorderDetected: boolean
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

export const evaluateVerificationClaimDeliverySemanticsTask1 = (
  input: VerificationClaimDeliverySemanticsTask1Input,
): VerificationClaimDeliverySemanticsTask1Result => {
  const duplicateStormDetected = input.duplicateCountInWindow > input.duplicateStormThreshold
  const semanticReorderDetected = input.semanticReorderViolations > input.semanticReorderThreshold

  const payload = {
    duplicateCountInWindow: input.duplicateCountInWindow,
    duplicateStormThreshold: input.duplicateStormThreshold,
    semanticReorderViolations: input.semanticReorderViolations,
    semanticReorderThreshold: input.semanticReorderThreshold,
    events: input.events,
    duplicateStormDetected,
    semanticReorderDetected,
  }

  if (duplicateStormDetected) {
    return {
      verdict: 'fail',
      reason: 'delivery-duplicate-storm',
      duplicateStormDetected,
      semanticReorderDetected,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'delivery-duplicate-storm' }),
    }
  }

  if (semanticReorderDetected) {
    return {
      verdict: 'fail',
      reason: 'delivery-semantic-reorder-violation',
      duplicateStormDetected,
      semanticReorderDetected,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'delivery-semantic-reorder-violation' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'delivery-semantics-pass',
    duplicateStormDetected,
    semanticReorderDetected,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'delivery-semantics-pass' }),
  }
}
