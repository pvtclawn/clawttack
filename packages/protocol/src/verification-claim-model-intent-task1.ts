import { createHash } from 'node:crypto'

export type ModelIntent = 'theoretical-bound' | 'practical-operational' | 'hybrid-consensus'

export type ModelIntentTask1Reason =
  | 'model-intent-pass'
  | 'model-intent-label-invalid'
  | 'model-intent-matrix-drift'

export interface ModelIntentEvidence {
  id: string
  intent: ModelIntent
  intentProvenanceValid: boolean
}

export interface ModelIntentCompatibilityMatrix {
  version: string
  hash: string
}

export interface VerificationClaimModelIntentTask1Input {
  claimIntent: ModelIntent
  evidence: ModelIntentEvidence[]
  matrix: ModelIntentCompatibilityMatrix
  expectedMatrixVersion: string
  expectedMatrixHash: string
}

export interface VerificationClaimModelIntentTask1Result {
  verdict: 'pass' | 'fail'
  reason: ModelIntentTask1Reason
  invalidEvidenceIds: string[]
  matrixLocked: boolean
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

export const evaluateVerificationClaimModelIntentTask1 = (
  input: VerificationClaimModelIntentTask1Input,
): VerificationClaimModelIntentTask1Result => {
  const invalidEvidenceIds = input.evidence.filter((e) => !e.intentProvenanceValid).map((e) => e.id)
  const matrixLocked =
    input.matrix.version === input.expectedMatrixVersion && input.matrix.hash === input.expectedMatrixHash

  const payload = {
    claimIntent: input.claimIntent,
    evidence: input.evidence,
    matrix: input.matrix,
    expectedMatrixVersion: input.expectedMatrixVersion,
    expectedMatrixHash: input.expectedMatrixHash,
    invalidEvidenceIds,
    matrixLocked,
  }

  if (invalidEvidenceIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'model-intent-label-invalid',
      invalidEvidenceIds,
      matrixLocked,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'model-intent-label-invalid' }),
    }
  }

  if (!matrixLocked) {
    return {
      verdict: 'fail',
      reason: 'model-intent-matrix-drift',
      invalidEvidenceIds,
      matrixLocked,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'model-intent-matrix-drift' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'model-intent-pass',
    invalidEvidenceIds,
    matrixLocked,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'model-intent-pass' }),
  }
}
