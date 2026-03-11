import { createHash } from 'node:crypto'

export type RunnerOperationType = 'create-battle' | 'accept-battle' | 'claim-timeout'

export type BatchRunnerIdempotenceTask1Reason = 'runner-op-pass' | 'runner-op-intent-binding-invalid'

export interface BatchRunnerIdempotenceTask1Input {
  chainId: number
  arena: string
  actor: string
  operationType: RunnerOperationType
  battleScope: string
  schemaVersion: string
  expectedSchemaVersion: string
  requiredIntentFields: string[]
  intent: Record<string, unknown>
  providedIntentHash: `0x${string}`
}

export interface BatchRunnerIdempotenceTask1Result {
  verdict: 'pass' | 'fail'
  reason: BatchRunnerIdempotenceTask1Reason
  missingIntentFields: string[]
  schemaVersionLocked: boolean
  providedIntentHashMatchesComputed: boolean
  computedIntentHash: `0x${string}`
  opKeySeed: `0x${string}`
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

const normalizeHash = (value: string): string => value.toLowerCase()

const isMissingRequiredField = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

export const computeRunnerIntentBindingHash = (params: {
  schemaVersion: string
  operationType: RunnerOperationType
  intent: Record<string, unknown>
}): `0x${string}` =>
  sha256({
    schemaVersion: params.schemaVersion,
    operationType: params.operationType,
    intent: params.intent,
  })

export const computeRunnerOpKeySeed = (params: {
  chainId: number
  arena: string
  actor: string
  operationType: RunnerOperationType
  battleScope: string
  intentHash: `0x${string}`
}): `0x${string}` =>
  sha256({
    chainId: params.chainId,
    arena: params.arena.toLowerCase(),
    actor: params.actor.toLowerCase(),
    operationType: params.operationType,
    battleScope: params.battleScope,
    intentHash: params.intentHash,
  })

export const evaluateBatchRunnerIdempotenceTask1 = (
  input: BatchRunnerIdempotenceTask1Input,
): BatchRunnerIdempotenceTask1Result => {
  const missingIntentFields = input.requiredIntentFields.filter((field) => isMissingRequiredField(input.intent[field]))
  const schemaVersionLocked = input.schemaVersion === input.expectedSchemaVersion
  const computedIntentHash = computeRunnerIntentBindingHash({
    schemaVersion: input.schemaVersion,
    operationType: input.operationType,
    intent: input.intent,
  })
  const providedIntentHashMatchesComputed =
    normalizeHash(input.providedIntentHash) === normalizeHash(computedIntentHash)

  const opKeySeed = computeRunnerOpKeySeed({
    chainId: input.chainId,
    arena: input.arena,
    actor: input.actor,
    operationType: input.operationType,
    battleScope: input.battleScope,
    intentHash: computedIntentHash,
  })

  const payload = {
    chainId: input.chainId,
    arena: input.arena,
    actor: input.actor,
    operationType: input.operationType,
    battleScope: input.battleScope,
    schemaVersion: input.schemaVersion,
    expectedSchemaVersion: input.expectedSchemaVersion,
    requiredIntentFields: input.requiredIntentFields,
    intent: input.intent,
    providedIntentHash: input.providedIntentHash,
    missingIntentFields,
    schemaVersionLocked,
    providedIntentHashMatchesComputed,
    computedIntentHash,
    opKeySeed,
  }

  if (!schemaVersionLocked || missingIntentFields.length > 0 || !providedIntentHashMatchesComputed) {
    return {
      verdict: 'fail',
      reason: 'runner-op-intent-binding-invalid',
      missingIntentFields,
      schemaVersionLocked,
      providedIntentHashMatchesComputed,
      computedIntentHash,
      opKeySeed,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'runner-op-intent-binding-invalid' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'runner-op-pass',
    missingIntentFields,
    schemaVersionLocked,
    providedIntentHashMatchesComputed,
    computedIntentHash,
    opKeySeed,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'runner-op-pass' }),
  }
}
