import { createHash } from 'node:crypto'

export type SystemModelTask1Reason =
  | 'system-model-pass'
  | 'system-model-profile-invalid'
  | 'system-model-assumptions-incomplete'

export interface SystemModelProfile {
  profileId: string
  profileAuthentic: boolean
  assumptions: {
    timingBounded: boolean
    failureSemanticsDeclared: boolean
    messageGuaranteesDeclared: boolean
  }
}

export interface VerificationClaimSystemModelTask1Input {
  claimProfile: SystemModelProfile
  evidenceProfiles: SystemModelProfile[]
}

export interface VerificationClaimSystemModelTask1Result {
  verdict: 'pass' | 'fail'
  reason: SystemModelTask1Reason
  invalidProfileIds: string[]
  incompleteAssumptionProfileIds: string[]
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

const assumptionsComplete = (profile: SystemModelProfile): boolean =>
  profile.assumptions.timingBounded &&
  profile.assumptions.failureSemanticsDeclared &&
  profile.assumptions.messageGuaranteesDeclared

export const evaluateVerificationClaimSystemModelTask1 = (
  input: VerificationClaimSystemModelTask1Input,
): VerificationClaimSystemModelTask1Result => {
  const allProfiles = [input.claimProfile, ...input.evidenceProfiles]

  const invalidProfileIds = allProfiles.filter((p) => !p.profileAuthentic).map((p) => p.profileId)

  const incompleteAssumptionProfileIds = allProfiles
    .filter((p) => !assumptionsComplete(p))
    .map((p) => p.profileId)

  const payload = {
    input,
    invalidProfileIds,
    incompleteAssumptionProfileIds,
  }

  if (invalidProfileIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'system-model-profile-invalid',
      invalidProfileIds,
      incompleteAssumptionProfileIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'system-model-profile-invalid' }),
    }
  }

  if (incompleteAssumptionProfileIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'system-model-assumptions-incomplete',
      invalidProfileIds,
      incompleteAssumptionProfileIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'system-model-assumptions-incomplete' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'system-model-pass',
    invalidProfileIds,
    incompleteAssumptionProfileIds,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'system-model-pass' }),
  }
}
