import { createHash } from 'node:crypto'

export type ViewLevel = 'local' | 'holon' | 'global'

export type VerificationClaimViewTask1Reason =
  | 'view-consistency-pass'
  | 'view-tag-provenance-invalid'
  | 'view-evidence-stale'

export interface VerificationClaimViewEvidence {
  id: string
  view: ViewLevel
  provenanceVerified: boolean
  observedAtUnixMs: number
}

export interface VerificationClaimViewTask1Input {
  nowUnixMs: number
  maxAgeByViewMs: Record<ViewLevel, number>
  evidence: VerificationClaimViewEvidence[]
}

export interface VerificationClaimViewTask1Result {
  verdict: 'pass' | 'fail'
  reason: VerificationClaimViewTask1Reason
  invalidProvenanceIds: string[]
  staleEvidenceIds: string[]
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

export const evaluateVerificationClaimViewConsistencyTask1 = (
  input: VerificationClaimViewTask1Input,
): VerificationClaimViewTask1Result => {
  const invalidProvenanceIds = input.evidence
    .filter((item) => !item.provenanceVerified)
    .map((item) => item.id)

  const staleEvidenceIds = input.evidence
    .filter((item) => {
      const ttl = input.maxAgeByViewMs[item.view]
      const age = Math.max(0, input.nowUnixMs - item.observedAtUnixMs)
      return age > ttl
    })
    .map((item) => item.id)

  const payload = {
    nowUnixMs: input.nowUnixMs,
    maxAgeByViewMs: input.maxAgeByViewMs,
    evidence: input.evidence,
    invalidProvenanceIds,
    staleEvidenceIds,
  }

  if (invalidProvenanceIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'view-tag-provenance-invalid',
      invalidProvenanceIds,
      staleEvidenceIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'view-tag-provenance-invalid' }),
    }
  }

  if (staleEvidenceIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'view-evidence-stale',
      invalidProvenanceIds,
      staleEvidenceIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'view-evidence-stale' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'view-consistency-pass',
    invalidProvenanceIds,
    staleEvidenceIds,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'view-consistency-pass' }),
  }
}
