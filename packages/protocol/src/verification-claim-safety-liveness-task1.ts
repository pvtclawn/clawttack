import { createHash } from 'node:crypto'

export type VerificationClaimSafetyLivenessTask1Reason =
  | 'pass'
  | 'terminal-prereq-missing'
  | 'trace-continuity-missing'

export type VerificationClaimPhase = 'ingest' | 'caveat' | 'triangulation' | 'aggregate' | 'terminal'

export interface VerificationClaimSafetyLivenessStep {
  stepIndex: number
  phase: VerificationClaimPhase
}

export interface VerificationClaimSafetyLivenessTask1Input {
  steps: VerificationClaimSafetyLivenessStep[]
}

export interface VerificationClaimSafetyLivenessTask1Result {
  verdict: 'pass' | 'fail'
  reason: VerificationClaimSafetyLivenessTask1Reason
  missingPrereqPhases: VerificationClaimPhase[]
  continuityBroken: boolean
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

const REQUIRED_TERMINAL_PREREQS: VerificationClaimPhase[] = ['ingest', 'caveat', 'triangulation', 'aggregate']

export const evaluateVerificationClaimSafetyLivenessTask1 = (
  input: VerificationClaimSafetyLivenessTask1Input,
): VerificationClaimSafetyLivenessTask1Result => {
  const seenPhases = new Set(input.steps.map((s) => s.phase))
  const hasTerminal = seenPhases.has('terminal')

  const missingPrereqPhases = hasTerminal
    ? REQUIRED_TERMINAL_PREREQS.filter((phase) => !seenPhases.has(phase))
    : []

  const sortedIndexes = input.steps.map((s) => s.stepIndex).sort((a, b) => a - b)
  const continuityBroken =
    sortedIndexes.length === 0 ||
    sortedIndexes[0] !== 0 ||
    sortedIndexes.some((index, i) => {
      if (i === 0) return false
      const prev = sortedIndexes[i - 1]
      return prev === undefined || index !== prev + 1
    })

  const payload = {
    steps: input.steps,
    hasTerminal,
    missingPrereqPhases,
    continuityBroken,
  }

  if (missingPrereqPhases.length > 0) {
    return {
      verdict: 'fail',
      reason: 'terminal-prereq-missing',
      missingPrereqPhases,
      continuityBroken,
      artifactHash: buildArtifactHash({ ...payload, verdict: 'fail', reason: 'terminal-prereq-missing' }),
    }
  }

  if (continuityBroken) {
    return {
      verdict: 'fail',
      reason: 'trace-continuity-missing',
      missingPrereqPhases,
      continuityBroken,
      artifactHash: buildArtifactHash({ ...payload, verdict: 'fail', reason: 'trace-continuity-missing' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    missingPrereqPhases,
    continuityBroken,
    artifactHash: buildArtifactHash({ ...payload, verdict: 'pass', reason: 'pass' }),
  }
}
