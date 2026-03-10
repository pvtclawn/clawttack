import { createHash } from 'node:crypto'

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

const isFiniteNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0

export type NonceIntentState =
  | 'built'
  | 'submitted'
  | 'pending'
  | 'confirmed'
  | 'replaced'
  | 'failed'

export interface NonceIntentRecord {
  intentId: string
  nonce: number
  ownerToken: number
  state: NonceIntentState
  replacedByIntentId?: string
}

export interface NonceLedgerSnapshot {
  schemaVersion: string
  scopeKey: string
  tokenFloor: number
  intents: NonceIntentRecord[]
}

export interface NoncePipelineTask1Input {
  before: NonceLedgerSnapshot
  after: NonceLedgerSnapshot
  actorToken: number
  activeToken: number
}

export type NoncePipelineTask1Reason =
  | 'pass'
  | 'stale-owner-token'
  | 'nonce-floor-regression'
  | 'nonce-ledger-rollback-detected'
  | 'invalid-ledger-state'

export interface NoncePipelineTask1Result {
  verdict: 'pass' | 'fail'
  reason: NoncePipelineTask1Reason
  beforeFingerprint?: `0x${string}`
  afterFingerprint?: `0x${string}`
  rolledBackIntentIds?: string[]
}

const normalizeSnapshot = (snapshot: NonceLedgerSnapshot): unknown => ({
  schemaVersion: snapshot.schemaVersion,
  scopeKey: snapshot.scopeKey,
  tokenFloor: snapshot.tokenFloor,
  intents: [...snapshot.intents]
    .map((intent) => ({
      intentId: intent.intentId,
      nonce: intent.nonce,
      ownerToken: intent.ownerToken,
      state: intent.state,
      replacedByIntentId: intent.replacedByIntentId ?? null,
    }))
    .sort((a, b) => a.intentId.localeCompare(b.intentId)),
})

export const computeNonceLedgerFingerprint = (
  snapshot: NonceLedgerSnapshot,
): `0x${string}` => {
  const digest = createHash('sha256')
    .update(stableStringify(normalizeSnapshot(snapshot)))
    .digest('hex')
  return `0x${digest}`
}

const validateIntent = (intent: NonceIntentRecord): boolean => {
  if (!intent.intentId || intent.intentId.trim().length === 0) return false
  if (!isFiniteNonNegativeInteger(intent.nonce)) return false
  if (!isFiniteNonNegativeInteger(intent.ownerToken)) return false
  if (!intent.state || intent.state.trim().length === 0) return false
  return true
}

const validateSnapshot = (snapshot: NonceLedgerSnapshot): boolean => {
  if (!snapshot.schemaVersion || snapshot.schemaVersion.trim().length === 0) return false
  if (!snapshot.scopeKey || snapshot.scopeKey.trim().length === 0) return false
  if (!isFiniteNonNegativeInteger(snapshot.tokenFloor)) return false
  if (!Array.isArray(snapshot.intents)) return false
  if (snapshot.intents.some((intent) => !validateIntent(intent))) return false

  const seen = new Set<string>()
  for (const intent of snapshot.intents) {
    if (seen.has(intent.intentId)) return false
    seen.add(intent.intentId)
  }

  return true
}

const rollbackDiff = (
  before: NonceLedgerSnapshot,
  after: NonceLedgerSnapshot,
): string[] => {
  const afterById = new Map(after.intents.map((intent) => [intent.intentId, intent]))
  const rolledBack: string[] = []

  for (const previous of before.intents) {
    const next = afterById.get(previous.intentId)
    if (!next) {
      rolledBack.push(previous.intentId)
      continue
    }

    if (
      next.nonce !== previous.nonce ||
      next.ownerToken !== previous.ownerToken ||
      next.state !== previous.state ||
      (next.replacedByIntentId ?? null) !== (previous.replacedByIntentId ?? null)
    ) {
      rolledBack.push(previous.intentId)
    }
  }

  return rolledBack.sort((a, b) => a.localeCompare(b))
}

/**
 * Task-1 nonce-pipeline gate:
 * - enforces stale-token hard fail,
 * - enforces monotonic nonce-floor,
 * - detects rollback/truncation by snapshot diff.
 */
export const evaluateNoncePipelineTask1 = (
  input: NoncePipelineTask1Input,
): NoncePipelineTask1Result => {
  const { before, after, actorToken, activeToken } = input

  if (
    !validateSnapshot(before) ||
    !validateSnapshot(after) ||
    !isFiniteNonNegativeInteger(actorToken) ||
    !isFiniteNonNegativeInteger(activeToken)
  ) {
    return {
      verdict: 'fail',
      reason: 'invalid-ledger-state',
    }
  }

  const beforeFingerprint = computeNonceLedgerFingerprint(before)
  const afterFingerprint = computeNonceLedgerFingerprint(after)

  if (before.scopeKey !== after.scopeKey || before.schemaVersion !== after.schemaVersion) {
    return {
      verdict: 'fail',
      reason: 'invalid-ledger-state',
      beforeFingerprint,
      afterFingerprint,
    }
  }

  if (actorToken !== activeToken) {
    return {
      verdict: 'fail',
      reason: 'stale-owner-token',
      beforeFingerprint,
      afterFingerprint,
    }
  }

  if (after.tokenFloor < before.tokenFloor) {
    return {
      verdict: 'fail',
      reason: 'nonce-floor-regression',
      beforeFingerprint,
      afterFingerprint,
    }
  }

  const rolledBackIntentIds = rollbackDiff(before, after)
  if (rolledBackIntentIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'nonce-ledger-rollback-detected',
      beforeFingerprint,
      afterFingerprint,
      rolledBackIntentIds,
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    beforeFingerprint,
    afterFingerprint,
  }
}
