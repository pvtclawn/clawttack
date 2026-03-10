import { createHash } from 'node:crypto'

export type SerializabilityTask1Reason =
  | 'serializability-pass'
  | 'serializability-dependency-order-violation'
  | 'serializability-commutativity-invalid'

export interface SerializabilityAction {
  id: string
  order: number
  dependencyOrderExpected: number
  operationType: string
  commutativityProof: boolean
}

export interface VerificationClaimSerializabilityTask1Input {
  actions: SerializabilityAction[]
  commutativityWhitelist: string[]
}

export interface VerificationClaimSerializabilityTask1Result {
  verdict: 'pass' | 'fail'
  reason: SerializabilityTask1Reason
  dependencyViolations: string[]
  invalidCommutativityProofs: string[]
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

export const evaluateVerificationClaimSerializabilityTask1 = (
  input: VerificationClaimSerializabilityTask1Input,
): VerificationClaimSerializabilityTask1Result => {
  const dependencyViolations = input.actions
    .filter((action) => action.order !== action.dependencyOrderExpected)
    .map((action) => action.id)

  const whitelist = new Set(input.commutativityWhitelist)
  const invalidCommutativityProofs = input.actions
    .filter((action) => action.commutativityProof && !whitelist.has(action.operationType))
    .map((action) => action.id)

  const payload = {
    input,
    dependencyViolations,
    invalidCommutativityProofs,
  }

  if (dependencyViolations.length > 0) {
    return {
      verdict: 'fail',
      reason: 'serializability-dependency-order-violation',
      dependencyViolations,
      invalidCommutativityProofs,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'serializability-dependency-order-violation' }),
    }
  }

  if (invalidCommutativityProofs.length > 0) {
    return {
      verdict: 'fail',
      reason: 'serializability-commutativity-invalid',
      dependencyViolations,
      invalidCommutativityProofs,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'serializability-commutativity-invalid' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'serializability-pass',
    dependencyViolations,
    invalidCommutativityProofs,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'serializability-pass' }),
  }
}
