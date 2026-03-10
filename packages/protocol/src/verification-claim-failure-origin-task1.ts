import { createHash } from 'node:crypto'

export type FailureOrigin = 'component' | 'network'

export type FailureOriginTask1Reason =
  | 'failure-origin-pass'
  | 'failure-origin-tag-invalid'
  | 'failure-origin-mixed-coverage-insufficient'

export interface FailureOriginEvidence {
  id: string
  origin: FailureOrigin
  originTagAuthentic: boolean
}

export interface VerificationClaimFailureOriginTask1Input {
  claimScope: 'component' | 'network' | 'mixed'
  evidence: FailureOriginEvidence[]
}

export interface VerificationClaimFailureOriginTask1Result {
  verdict: 'pass' | 'fail'
  reason: FailureOriginTask1Reason
  invalidOriginTagIds: string[]
  hasComponentCoverage: boolean
  hasNetworkCoverage: boolean
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

export const evaluateVerificationClaimFailureOriginTask1 = (
  input: VerificationClaimFailureOriginTask1Input,
): VerificationClaimFailureOriginTask1Result => {
  const invalidOriginTagIds = input.evidence
    .filter((item) => !item.originTagAuthentic)
    .map((item) => item.id)

  const hasComponentCoverage = input.evidence.some((item) => item.origin === 'component')
  const hasNetworkCoverage = input.evidence.some((item) => item.origin === 'network')

  const payload = {
    claimScope: input.claimScope,
    evidence: input.evidence,
    invalidOriginTagIds,
    hasComponentCoverage,
    hasNetworkCoverage,
  }

  if (invalidOriginTagIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'failure-origin-tag-invalid',
      invalidOriginTagIds,
      hasComponentCoverage,
      hasNetworkCoverage,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'failure-origin-tag-invalid' }),
    }
  }

  if (
    (input.claimScope === 'component' && !hasComponentCoverage) ||
    (input.claimScope === 'network' && !hasNetworkCoverage) ||
    (input.claimScope === 'mixed' && (!hasComponentCoverage || !hasNetworkCoverage))
  ) {
    return {
      verdict: 'fail',
      reason: 'failure-origin-mixed-coverage-insufficient',
      invalidOriginTagIds,
      hasComponentCoverage,
      hasNetworkCoverage,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'failure-origin-mixed-coverage-insufficient' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'failure-origin-pass',
    invalidOriginTagIds,
    hasComponentCoverage,
    hasNetworkCoverage,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'failure-origin-pass' }),
  }
}
