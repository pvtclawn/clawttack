import { createHash } from 'node:crypto'

export type TimeoutBucketCommutativityTask1Reason =
  | 'timeout-bucket-commutative-pass'
  | 'timeout-bucket-semantic-flag-invalid'

export interface TimeoutBucketSemanticCapability {
  reducerVersion: string
  reducerDigest: string
  commutative: boolean
  idempotent: boolean
}

export interface TimeoutBucketCommutativityTask1Input {
  reducerVersion: string
  reducerDigest: string
  declaredCommutative: boolean
  declaredIdempotent: boolean
  authenticatedCapabilities: TimeoutBucketSemanticCapability[]
}

export interface TimeoutBucketCommutativityTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutBucketCommutativityTask1Reason
  capabilityFound: boolean
  reducerDigestMatch: boolean
  semanticFlagsMatch: boolean
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

export const evaluateTimeoutBucketCommutativityTask1 = (
  input: TimeoutBucketCommutativityTask1Input,
): TimeoutBucketCommutativityTask1Result => {
  const reducerVersion = normalize(input.reducerVersion)
  const reducerDigest = normalize(input.reducerDigest)

  const capabilities = input.authenticatedCapabilities.map((capability) => ({
    reducerVersion: normalize(capability.reducerVersion),
    reducerDigest: normalize(capability.reducerDigest),
    commutative: capability.commutative,
    idempotent: capability.idempotent,
  }))

  const matched = capabilities.find((capability) => capability.reducerVersion === reducerVersion)
  const capabilityFound = Boolean(matched)
  const reducerDigestMatch = Boolean(matched && matched.reducerDigest === reducerDigest)
  const semanticFlagsMatch = Boolean(
    matched &&
      matched.commutative === input.declaredCommutative &&
      matched.idempotent === input.declaredIdempotent,
  )

  const payload = {
    reducerVersion,
    reducerDigest,
    declaredCommutative: input.declaredCommutative,
    declaredIdempotent: input.declaredIdempotent,
    capabilities,
    capabilityFound,
    reducerDigestMatch,
    semanticFlagsMatch,
  }

  if (!capabilityFound || !reducerDigestMatch || !semanticFlagsMatch) {
    return {
      verdict: 'fail',
      reason: 'timeout-bucket-semantic-flag-invalid',
      capabilityFound,
      reducerDigestMatch,
      semanticFlagsMatch,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-bucket-semantic-flag-invalid' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-bucket-commutative-pass',
    capabilityFound,
    reducerDigestMatch,
    semanticFlagsMatch,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-bucket-commutative-pass' }),
  }
}
