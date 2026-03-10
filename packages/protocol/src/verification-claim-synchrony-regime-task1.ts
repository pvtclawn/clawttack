import { createHash } from 'node:crypto'

export type SynchronyRegime = 'sync' | 'partial-sync' | 'async'

export type SynchronyRegimeTask1Reason =
  | 'synchrony-regime-pass'
  | 'synchrony-signal-invalid'
  | 'synchrony-window-incomplete'

export interface SynchronyWindowSample {
  startedAtUnixMs: number
  endedAtUnixMs: number
  regime: SynchronyRegime
  signalAuthentic: boolean
}

export interface VerificationClaimSynchronyRegimeTask1Input {
  expectedWindowStartUnixMs: number
  expectedWindowEndUnixMs: number
  samples: SynchronyWindowSample[]
}

export interface VerificationClaimSynchronyRegimeTask1Result {
  verdict: 'pass' | 'fail'
  reason: SynchronyRegimeTask1Reason
  invalidSignalIndexes: number[]
  windowCoverageComplete: boolean
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

const sortSamples = (samples: SynchronyWindowSample[]): SynchronyWindowSample[] =>
  [...samples].sort((a, b) => a.startedAtUnixMs - b.startedAtUnixMs)

const hasCompleteCoverage = (
  expectedStart: number,
  expectedEnd: number,
  samples: SynchronyWindowSample[],
): boolean => {
  if (samples.length === 0) return false
  const ordered = sortSamples(samples)
  const first = ordered[0]
  if (!first || first.startedAtUnixMs > expectedStart) return false

  let cursor = Math.max(expectedStart, first.startedAtUnixMs)
  for (const sample of ordered) {
    if (sample.startedAtUnixMs > cursor) return false
    cursor = Math.max(cursor, sample.endedAtUnixMs)
    if (cursor >= expectedEnd) return true
  }
  return cursor >= expectedEnd
}

export const evaluateVerificationClaimSynchronyRegimeTask1 = (
  input: VerificationClaimSynchronyRegimeTask1Input,
): VerificationClaimSynchronyRegimeTask1Result => {
  const invalidSignalIndexes = input.samples
    .map((sample, idx) => ({ sample, idx }))
    .filter(({ sample }) => !sample.signalAuthentic)
    .map(({ idx }) => idx)

  const windowCoverageComplete = hasCompleteCoverage(
    input.expectedWindowStartUnixMs,
    input.expectedWindowEndUnixMs,
    input.samples,
  )

  const payload = {
    input,
    invalidSignalIndexes,
    windowCoverageComplete,
  }

  if (invalidSignalIndexes.length > 0) {
    return {
      verdict: 'fail',
      reason: 'synchrony-signal-invalid',
      invalidSignalIndexes,
      windowCoverageComplete,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'synchrony-signal-invalid' }),
    }
  }

  if (!windowCoverageComplete) {
    return {
      verdict: 'fail',
      reason: 'synchrony-window-incomplete',
      invalidSignalIndexes,
      windowCoverageComplete,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'synchrony-window-incomplete' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'synchrony-regime-pass',
    invalidSignalIndexes,
    windowCoverageComplete,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'synchrony-regime-pass' }),
  }
}
