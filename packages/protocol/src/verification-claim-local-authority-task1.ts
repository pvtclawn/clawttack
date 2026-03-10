import { createHash } from 'node:crypto'

export type LocalAuthorityTask1Reason =
  | 'local-authority-pass'
  | 'authority-identity-invalid'
  | 'authority-quorum-quality-insufficient'

export interface LocalAuthorityRecord {
  authorityId: string
  authorityClass: string
  isAuthentic: boolean
  qualityScore: number
}

export interface VerificationClaimLocalAuthorityTask1Input {
  requiredUniqueAuthorities: number
  minQualityScore: number
  records: LocalAuthorityRecord[]
}

export interface VerificationClaimLocalAuthorityTask1Result {
  verdict: 'pass' | 'fail'
  reason: LocalAuthorityTask1Reason
  invalidAuthorityIds: string[]
  duplicateAuthorityIds: string[]
  uniqueAuthorities: number
  totalQualityScore: number
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

export const evaluateVerificationClaimLocalAuthorityTask1 = (
  input: VerificationClaimLocalAuthorityTask1Input,
): VerificationClaimLocalAuthorityTask1Result => {
  const invalidAuthorityIds = input.records.filter((r) => !r.isAuthentic).map((r) => r.authorityId)

  const counts = new Map<string, number>()
  for (const record of input.records) {
    counts.set(record.authorityId, (counts.get(record.authorityId) ?? 0) + 1)
  }
  const duplicateAuthorityIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b))

  const uniqueAuthorities = counts.size
  const totalQualityScore = input.records.reduce((sum, r) => sum + r.qualityScore, 0)

  const payload = {
    input,
    invalidAuthorityIds,
    duplicateAuthorityIds,
    uniqueAuthorities,
    totalQualityScore,
  }

  if (invalidAuthorityIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'authority-identity-invalid',
      invalidAuthorityIds,
      duplicateAuthorityIds,
      uniqueAuthorities,
      totalQualityScore,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'authority-identity-invalid' }),
    }
  }

  if (
    duplicateAuthorityIds.length > 0 ||
    uniqueAuthorities < input.requiredUniqueAuthorities ||
    totalQualityScore < input.minQualityScore
  ) {
    return {
      verdict: 'fail',
      reason: 'authority-quorum-quality-insufficient',
      invalidAuthorityIds,
      duplicateAuthorityIds,
      uniqueAuthorities,
      totalQualityScore,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'authority-quorum-quality-insufficient' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'local-authority-pass',
    invalidAuthorityIds,
    duplicateAuthorityIds,
    uniqueAuthorities,
    totalQualityScore,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'local-authority-pass' }),
  }
}
