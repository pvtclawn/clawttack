import { createHash } from 'node:crypto'

export type TimeoutEvidenceOperationType = 'create-battle' | 'accept-battle' | 'claim-timeout'
export type TimeoutEvidenceProbeClass = 'rpc' | 'tx-receipt' | 'state-read' | 'indexer' | 'mempool'

export type TimeoutEvidenceContextTask1Reason =
  | 'timeout-evidence-context-pass'
  | 'timeout-evidence-canonicalization-invalid'
  | 'timeout-evidence-operation-scope-mismatch'

export interface TimeoutEvidenceContext {
  chainId: number
  arena: string
  operationType: TimeoutEvidenceOperationType
  operationId: string
  probeClass: TimeoutEvidenceProbeClass
  providerId: string
  windowId: string
  counter: number
}

export interface TimeoutEvidenceContextTask1Input {
  expectedContext: TimeoutEvidenceContext
  evidenceContext: TimeoutEvidenceContext
}

export interface TimeoutEvidenceContextTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutEvidenceContextTask1Reason
  contextHash: `0x${string}`
  artifactHash: `0x${string}`
}

interface CanonicalTimeoutEvidenceContext {
  chainId: number
  arena: string
  operationType: TimeoutEvidenceOperationType
  operationId: string
  probeClass: TimeoutEvidenceProbeClass
  providerId: string
  windowId: string
  counter: number
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

const strictLowercaseAddress = (value: string): string | null => {
  if (!/^0x[a-f0-9]{40}$/.test(value)) return null
  return value
}

const strictOperationId = (value: string, operationType: TimeoutEvidenceOperationType): string | null => {
  const expectedPattern = new RegExp(`^${operationType}#[0-9]+$`)
  if (!expectedPattern.test(value)) return null
  return value
}

const strictProviderId = (value: string): string | null => {
  if (!/^[a-z0-9][a-z0-9._:-]{1,62}[a-z0-9]$/.test(value)) return null
  return value
}

const strictWindowId = (value: string): string | null => {
  if (!/^w-[0-9]+$/.test(value)) return null
  return value
}

const canonicalizeContext = (context: TimeoutEvidenceContext): CanonicalTimeoutEvidenceContext | null => {
  if (!Number.isInteger(context.chainId) || context.chainId <= 0) return null
  if (!Number.isInteger(context.counter) || context.counter < 0) return null

  const arena = strictLowercaseAddress(context.arena)
  const providerId = strictProviderId(context.providerId)
  const windowId = strictWindowId(context.windowId)
  const operationId = strictOperationId(context.operationId, context.operationType)

  if (!arena || !providerId || !windowId || !operationId) return null

  return {
    chainId: context.chainId,
    arena,
    operationType: context.operationType,
    operationId,
    probeClass: context.probeClass,
    providerId,
    windowId,
    counter: context.counter,
  }
}

const contextsMatch = (
  expectedContext: CanonicalTimeoutEvidenceContext,
  evidenceContext: CanonicalTimeoutEvidenceContext,
): boolean =>
  expectedContext.chainId === evidenceContext.chainId &&
  expectedContext.arena === evidenceContext.arena &&
  expectedContext.operationType === evidenceContext.operationType &&
  expectedContext.operationId === evidenceContext.operationId &&
  expectedContext.probeClass === evidenceContext.probeClass &&
  expectedContext.providerId === evidenceContext.providerId &&
  expectedContext.windowId === evidenceContext.windowId &&
  expectedContext.counter === evidenceContext.counter

export const evaluateTimeoutEvidenceContextTask1 = (
  input: TimeoutEvidenceContextTask1Input,
): TimeoutEvidenceContextTask1Result => {
  const expectedContext = canonicalizeContext(input.expectedContext)
  const evidenceContext = canonicalizeContext(input.evidenceContext)

  if (!expectedContext || !evidenceContext) {
    return {
      verdict: 'fail',
      reason: 'timeout-evidence-canonicalization-invalid',
      contextHash: sha256({ expectedContext: input.expectedContext, evidenceContext: input.evidenceContext }),
      artifactHash: sha256({
        expectedContext: input.expectedContext,
        evidenceContext: input.evidenceContext,
        verdict: 'fail',
        reason: 'timeout-evidence-canonicalization-invalid',
      }),
    }
  }

  const contextHash = sha256({ expectedContext, evidenceContext })

  if (!contextsMatch(expectedContext, evidenceContext)) {
    return {
      verdict: 'fail',
      reason: 'timeout-evidence-operation-scope-mismatch',
      contextHash,
      artifactHash: sha256({
        expectedContext,
        evidenceContext,
        verdict: 'fail',
        reason: 'timeout-evidence-operation-scope-mismatch',
      }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-evidence-context-pass',
    contextHash,
    artifactHash: sha256({
      expectedContext,
      evidenceContext,
      verdict: 'pass',
      reason: 'timeout-evidence-context-pass',
    }),
  }
}
