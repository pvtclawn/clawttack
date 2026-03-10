import { createHash } from 'node:crypto'

export type FailureModel = 'crash-stop' | 'omission' | 'crash-recovery' | 'byzantine'

export type FailureModelTask1Reason =
  | 'failure-model-pass'
  | 'failure-model-downscope-detected'
  | 'failure-model-mismatch'

export interface FailureModelEvidence {
  id: string
  model: FailureModel
}

export interface VerificationClaimFailureModelTask1Input {
  declaredModel: FailureModel
  effectiveModel: FailureModel
  evidence: FailureModelEvidence[]
}

export interface VerificationClaimFailureModelTask1Result {
  verdict: 'pass' | 'fail'
  reason: FailureModelTask1Reason
  incompatibleEvidenceIds: string[]
  downscopeDetected: boolean
  artifactHash: `0x${string}`
}

const modelRank: Record<FailureModel, number> = {
  'crash-stop': 1,
  omission: 2,
  'crash-recovery': 3,
  byzantine: 4,
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

export const evaluateVerificationClaimFailureModelTask1 = (
  input: VerificationClaimFailureModelTask1Input,
): VerificationClaimFailureModelTask1Result => {
  const downscopeDetected = modelRank[input.effectiveModel] < modelRank[input.declaredModel]

  const incompatibleEvidenceIds = input.evidence
    .filter((item) => modelRank[item.model] < modelRank[input.declaredModel])
    .map((item) => item.id)

  const payload = {
    input,
    downscopeDetected,
    incompatibleEvidenceIds,
  }

  if (downscopeDetected) {
    return {
      verdict: 'fail',
      reason: 'failure-model-downscope-detected',
      incompatibleEvidenceIds,
      downscopeDetected,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'failure-model-downscope-detected' }),
    }
  }

  if (incompatibleEvidenceIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'failure-model-mismatch',
      incompatibleEvidenceIds,
      downscopeDetected,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'failure-model-mismatch' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'failure-model-pass',
    incompatibleEvidenceIds,
    downscopeDetected,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'failure-model-pass' }),
  }
}
