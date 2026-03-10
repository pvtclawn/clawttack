import { createHash } from 'node:crypto'

export type TraceTask1Reason = 'pass' | 'step-provenance-invalid' | 'trace-replay-detected'

export interface VerificationClaimTraceTask1Step {
  claimId: string
  inputRoot: string
  phase: 'ingest' | 'caveat' | 'triangulation' | 'aggregate' | string
  stepIndex: number
}

export interface VerificationClaimTraceTask1Input {
  envelopeCreatedAtUnixMs: number
  nowUnixMs: number
  freshnessTtlMs: number
  canonicalClaimId: string
  canonicalInputRoot: string
  steps: VerificationClaimTraceTask1Step[]
}

export interface VerificationClaimTraceTask1Result {
  verdict: 'pass' | 'fail'
  reason: TraceTask1Reason
  invalidStepIndexes: number[]
  replayDetected: boolean
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

const buildArtifactHash = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const normalize = (text: string): string => text.trim().toLowerCase()

export const evaluateVerificationClaimTraceTask1 = (
  input: VerificationClaimTraceTask1Input,
): VerificationClaimTraceTask1Result => {
  const canonicalClaimId = normalize(input.canonicalClaimId)
  const canonicalInputRoot = normalize(input.canonicalInputRoot)

  const invalidStepIndexes: number[] = []
  input.steps.forEach((step, index) => {
    const stepClaimId = normalize(step.claimId)
    const stepInputRoot = normalize(step.inputRoot)
    const validStepIndex = Number.isInteger(step.stepIndex) && step.stepIndex >= 0

    if (stepClaimId !== canonicalClaimId || stepInputRoot !== canonicalInputRoot || !validStepIndex) {
      invalidStepIndexes.push(index)
    }
  })

  const traceAgeMs = Math.max(0, input.nowUnixMs - input.envelopeCreatedAtUnixMs)
  const replayDetected = traceAgeMs > input.freshnessTtlMs

  const payload = {
    canonicalClaimId,
    canonicalInputRoot,
    freshnessTtlMs: input.freshnessTtlMs,
    envelopeCreatedAtUnixMs: input.envelopeCreatedAtUnixMs,
    nowUnixMs: input.nowUnixMs,
    steps: input.steps.map((step) => ({
      claimId: normalize(step.claimId),
      inputRoot: normalize(step.inputRoot),
      phase: step.phase,
      stepIndex: step.stepIndex,
    })),
    invalidStepIndexes,
    replayDetected,
  }

  if (invalidStepIndexes.length > 0) {
    return {
      verdict: 'fail',
      reason: 'step-provenance-invalid',
      invalidStepIndexes,
      replayDetected,
      artifactHash: buildArtifactHash({ ...payload, verdict: 'fail', reason: 'step-provenance-invalid' }),
    }
  }

  if (replayDetected) {
    return {
      verdict: 'fail',
      reason: 'trace-replay-detected',
      invalidStepIndexes,
      replayDetected,
      artifactHash: buildArtifactHash({ ...payload, verdict: 'fail', reason: 'trace-replay-detected' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    invalidStepIndexes,
    replayDetected,
    artifactHash: buildArtifactHash({ ...payload, verdict: 'pass', reason: 'pass' }),
  }
}
