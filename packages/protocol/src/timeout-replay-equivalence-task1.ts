import { createHash } from 'node:crypto'

export type TimeoutReplayEquivalenceTask1Reason =
  | 'timeout-replay-equivalent'
  | 'timeout-replay-reducer-version-invalid'
  | 'timeout-replay-context-mismatch'

export interface TimeoutReplayContextTuple {
  chainId: number
  arena: string
  operationId: string
  reducerVersion: string
}

export interface TimeoutReplayEquivalenceTask1Input {
  expectedReducerDigest: string
  observedReducerDigest: string
  expectedContext: TimeoutReplayContextTuple
  observedContext: TimeoutReplayContextTuple
}

export interface TimeoutReplayEquivalenceTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutReplayEquivalenceTask1Reason
  reducerDigestMatch: boolean
  contextMatch: boolean
  normalizedContextHash: `0x${string}`
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

const normalize = (value: string): string => value.trim().toLowerCase()

const normalizeContext = (context: TimeoutReplayContextTuple): TimeoutReplayContextTuple => ({
  chainId: context.chainId,
  arena: normalize(context.arena),
  operationId: normalize(context.operationId),
  reducerVersion: normalize(context.reducerVersion),
})

const contextsEqual = (a: TimeoutReplayContextTuple, b: TimeoutReplayContextTuple): boolean =>
  a.chainId === b.chainId &&
  a.arena === b.arena &&
  a.operationId === b.operationId &&
  a.reducerVersion === b.reducerVersion

export const evaluateTimeoutReplayEquivalenceTask1 = (
  input: TimeoutReplayEquivalenceTask1Input,
): TimeoutReplayEquivalenceTask1Result => {
  const expectedContext = normalizeContext(input.expectedContext)
  const observedContext = normalizeContext(input.observedContext)
  const reducerDigestMatch = normalize(input.expectedReducerDigest) === normalize(input.observedReducerDigest)
  const contextMatch = contextsEqual(expectedContext, observedContext)

  const payload = {
    expectedReducerDigest: normalize(input.expectedReducerDigest),
    observedReducerDigest: normalize(input.observedReducerDigest),
    expectedContext,
    observedContext,
    reducerDigestMatch,
    contextMatch,
  }

  const normalizedContextHash = sha256({ expectedContext, observedContext })

  if (!reducerDigestMatch) {
    return {
      verdict: 'fail',
      reason: 'timeout-replay-reducer-version-invalid',
      reducerDigestMatch,
      contextMatch,
      normalizedContextHash,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-replay-reducer-version-invalid' }),
    }
  }

  if (!contextMatch) {
    return {
      verdict: 'fail',
      reason: 'timeout-replay-context-mismatch',
      reducerDigestMatch,
      contextMatch,
      normalizedContextHash,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-replay-context-mismatch' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-replay-equivalent',
    reducerDigestMatch,
    contextMatch,
    normalizedContextHash,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-replay-equivalent' }),
  }
}
