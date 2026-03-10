import { createHash } from 'node:crypto'

export type MembershipEpochTask1Reason =
  | 'membership-epoch-pass'
  | 'membership-epoch-stale'
  | 'membership-epoch-split-view'

export interface MembershipEpochEvidence {
  id: string
  epochId: string
  observedAtUnixMs: number
}

export interface VerificationClaimMembershipEpochTask1Input {
  currentEpochId: string
  currentTimeUnixMs: number
  maxStalenessMs: number
  evidence: MembershipEpochEvidence[]
}

export interface VerificationClaimMembershipEpochTask1Result {
  verdict: 'pass' | 'fail'
  reason: MembershipEpochTask1Reason
  staleEvidenceIds: string[]
  splitViewDetected: boolean
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

export const evaluateVerificationClaimMembershipEpochTask1 = (
  input: VerificationClaimMembershipEpochTask1Input,
): VerificationClaimMembershipEpochTask1Result => {
  const staleEvidenceIds = input.evidence
    .filter((item) => input.currentTimeUnixMs - item.observedAtUnixMs > input.maxStalenessMs)
    .map((item) => item.id)

  const epochSet = new Set(input.evidence.map((item) => item.epochId))
  const splitViewDetected = epochSet.size > 1 || (epochSet.size === 1 && !epochSet.has(input.currentEpochId))

  const payload = {
    input,
    staleEvidenceIds,
    splitViewDetected,
  }

  if (staleEvidenceIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'membership-epoch-stale',
      staleEvidenceIds,
      splitViewDetected,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'membership-epoch-stale' }),
    }
  }

  if (splitViewDetected) {
    return {
      verdict: 'fail',
      reason: 'membership-epoch-split-view',
      staleEvidenceIds,
      splitViewDetected,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'membership-epoch-split-view' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'membership-epoch-pass',
    staleEvidenceIds,
    splitViewDetected,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'membership-epoch-pass' }),
  }
}
