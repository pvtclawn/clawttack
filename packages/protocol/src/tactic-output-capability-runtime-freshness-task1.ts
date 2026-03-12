import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs'
import { createHash } from 'node:crypto'

import type { TacticOutputCapabilityContextScope } from './tactic-output-capability-context-task1.ts'

export type TacticOutputCapabilityRuntimeSide = 'attacker' | 'defender'

export type TacticOutputCapabilityRuntimeFreshnessDecision =
  | 'allow'
  | 'duplicate'
  | 'wrong-runtime-binding'
  | 'stale-turn'
  | 'stale-context'
  | 'dependency-invalid'

export interface TacticOutputCapabilityRuntimeFreshnessClaim {
  schemaVersion: number
  battleId: string
  side: TacticOutputCapabilityRuntimeSide
  runId: string
  turnIndex: number
  contextVersion: number
  scope: TacticOutputCapabilityContextScope
  actionKind: string
  actionPayload: unknown
}

export interface TacticOutputCapabilityRuntimeFreshnessState {
  battleId: string
  side: TacticOutputCapabilityRuntimeSide
  runId: string
  turnIndex: number
  contextVersion: number
  dependencyValid: boolean
}

export interface TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata {
  battleId: string
  runId: string
  turnIndex: number
  contextVersion: number
  decision: TacticOutputCapabilityRuntimeFreshnessDecision
}

export interface TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  has(digest: `0x${string}`): boolean
  markConsumed(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
  ): void
}

export interface TacticOutputCapabilityRuntimeFreshnessTask1Input {
  claim: TacticOutputCapabilityRuntimeFreshnessClaim
  runtime: TacticOutputCapabilityRuntimeFreshnessState
  consumedDigests: TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore
  consumeOnAllow?: boolean
}

export interface TacticOutputCapabilityRuntimeFreshnessTask1Result {
  decision: TacticOutputCapabilityRuntimeFreshnessDecision
  claimDigest: `0x${string}`
  normalizedClaim: TacticOutputCapabilityRuntimeFreshnessClaim
  normalizedRuntime: TacticOutputCapabilityRuntimeFreshnessState
  artifactHash: `0x${string}`
}

export interface TacticOutputCapabilityRuntimeFreshnessLedgerRecord {
  schemaVersion: number
  digest: `0x${string}`
  battleId: string
  runId: string
  turnIndex: number
  contextVersion: number
  timestamp: string
  checksum: `0x${string}`
}

export interface TacticOutputCapabilityRuntimeFreshnessFileBackedStoreOptions {
  filePath: string
  now?: () => string
}

const CLAIM_DIGEST_DOMAIN = 'clawttack/tactic-output-capability-runtime-freshness-task1/claim-digest'
const RESULT_ARTIFACT_DOMAIN = 'clawttack/tactic-output-capability-runtime-freshness-task1/result'
const LEDGER_RECORD_DOMAIN = 'clawttack/tactic-output-capability-runtime-freshness-task1/ledger-record'
const LEDGER_SCHEMA_VERSION = 1

export class InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore
  implements TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  readonly #digests = new Map<`0x${string}`, TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata>()

  has(digest: `0x${string}`): boolean {
    return this.#digests.has(digest)
  }

  markConsumed(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
  ): void {
    this.#digests.set(digest, metadata)
  }
}

export class FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore
  implements TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  readonly #filePath: string
  readonly #now: () => string
  readonly #digests = new Map<`0x${string}`, TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata>()
  #loaded = false

  constructor(options: TacticOutputCapabilityRuntimeFreshnessFileBackedStoreOptions) {
    this.#filePath = options.filePath
    this.#now = options.now ?? (() => new Date().toISOString())
  }

  load(): void {
    this.#digests.clear()

    if (!existsSync(this.#filePath)) {
      this.#loaded = true
      return
    }

    const raw = readFileSync(this.#filePath, 'utf8')
    if (raw.length === 0) {
      this.#loaded = true
      return
    }

    if (!raw.endsWith('\n')) {
      throw new Error('Freshness ledger has trailing partial record')
    }

    const lines = raw.split('\n').filter((line) => line.length > 0)
    for (const line of lines) {
      const parsed = JSON.parse(line) as Partial<TacticOutputCapabilityRuntimeFreshnessLedgerRecord>
      const record = validateLedgerRecord(parsed)
      this.#digests.set(record.digest, {
        battleId: record.battleId,
        runId: record.runId,
        turnIndex: record.turnIndex,
        contextVersion: record.contextVersion,
        decision: 'allow',
      })
    }

    this.#loaded = true
  }

  has(digest: `0x${string}`): boolean {
    this.assertLoaded()
    return this.#digests.has(digest)
  }

  markConsumed(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
  ): void {
    this.assertLoaded()

    const record = createLedgerRecord({
      digest,
      battleId: metadata.battleId,
      runId: metadata.runId,
      turnIndex: metadata.turnIndex,
      contextVersion: metadata.contextVersion,
      timestamp: this.#now(),
    })
    const line = `${stableStringify(record)}\n`

    const fd = openSync(this.#filePath, 'a')
    try {
      writeSync(fd, line)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }

    this.#digests.set(digest, metadata)
  }

  private assertLoaded(): void {
    if (!this.#loaded) {
      throw new Error('Freshness ledger must be loaded before use')
    }
  }
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

const normalizeToken = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

const normalizeScope = (scope: TacticOutputCapabilityContextScope): TacticOutputCapabilityContextScope => ({
  scopeClass: scope.scopeClass,
  namespace: normalizeToken(scope.namespace),
  scopeId: normalizeToken(scope.scopeId),
  scopeVersion: scope.scopeVersion,
})

const normalizeClaim = (
  claim: TacticOutputCapabilityRuntimeFreshnessClaim,
): TacticOutputCapabilityRuntimeFreshnessClaim => ({
  schemaVersion: claim.schemaVersion,
  battleId: normalizeToken(claim.battleId),
  side: claim.side,
  runId: normalizeToken(claim.runId),
  turnIndex: claim.turnIndex,
  contextVersion: claim.contextVersion,
  scope: normalizeScope(claim.scope),
  actionKind: normalizeToken(claim.actionKind),
  actionPayload: claim.actionPayload,
})

const normalizeRuntime = (
  runtime: TacticOutputCapabilityRuntimeFreshnessState,
): TacticOutputCapabilityRuntimeFreshnessState => ({
  battleId: normalizeToken(runtime.battleId),
  side: runtime.side,
  runId: normalizeToken(runtime.runId),
  turnIndex: runtime.turnIndex,
  contextVersion: runtime.contextVersion,
  dependencyValid: runtime.dependencyValid,
})

const createLedgerChecksum = (record: Omit<TacticOutputCapabilityRuntimeFreshnessLedgerRecord, 'checksum'>): `0x${string}` => sha256({
  domain: LEDGER_RECORD_DOMAIN,
  schemaVersion: record.schemaVersion,
  digest: record.digest,
  battleId: record.battleId,
  runId: record.runId,
  turnIndex: record.turnIndex,
  contextVersion: record.contextVersion,
  timestamp: record.timestamp,
})

const createLedgerRecord = (input: {
  digest: `0x${string}`
  battleId: string
  runId: string
  turnIndex: number
  contextVersion: number
  timestamp: string
}): TacticOutputCapabilityRuntimeFreshnessLedgerRecord => {
  const baseRecord = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    digest: input.digest,
    battleId: normalizeToken(input.battleId),
    runId: normalizeToken(input.runId),
    turnIndex: input.turnIndex,
    contextVersion: input.contextVersion,
    timestamp: input.timestamp,
  } satisfies Omit<TacticOutputCapabilityRuntimeFreshnessLedgerRecord, 'checksum'>

  return {
    ...baseRecord,
    checksum: createLedgerChecksum(baseRecord),
  }
}

const validateLedgerRecord = (
  record: Partial<TacticOutputCapabilityRuntimeFreshnessLedgerRecord>,
): TacticOutputCapabilityRuntimeFreshnessLedgerRecord => {
  if (record.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new Error('Freshness ledger schema version mismatch')
  }
  if (
    typeof record.digest !== 'string'
    || typeof record.battleId !== 'string'
    || typeof record.runId !== 'string'
    || typeof record.turnIndex !== 'number'
    || typeof record.contextVersion !== 'number'
    || typeof record.timestamp !== 'string'
    || typeof record.checksum !== 'string'
  ) {
    throw new Error('Freshness ledger record shape is invalid')
  }

  const normalizedRecord: TacticOutputCapabilityRuntimeFreshnessLedgerRecord = {
    schemaVersion: record.schemaVersion,
    digest: record.digest as `0x${string}`,
    battleId: normalizeToken(record.battleId),
    runId: normalizeToken(record.runId),
    turnIndex: record.turnIndex,
    contextVersion: record.contextVersion,
    timestamp: record.timestamp,
    checksum: record.checksum as `0x${string}`,
  }

  const expectedChecksum = createLedgerChecksum({
    schemaVersion: normalizedRecord.schemaVersion,
    digest: normalizedRecord.digest,
    battleId: normalizedRecord.battleId,
    runId: normalizedRecord.runId,
    turnIndex: normalizedRecord.turnIndex,
    contextVersion: normalizedRecord.contextVersion,
    timestamp: normalizedRecord.timestamp,
  })

  if (normalizedRecord.checksum !== expectedChecksum) {
    throw new Error('Freshness ledger checksum mismatch')
  }

  return normalizedRecord
}

export const computeTacticOutputCapabilityRuntimeClaimDigestTask1 = (
  claim: TacticOutputCapabilityRuntimeFreshnessClaim,
): `0x${string}` => {
  const normalizedClaim = normalizeClaim(claim)

  return sha256({
    domain: CLAIM_DIGEST_DOMAIN,
    schemaVersion: normalizedClaim.schemaVersion,
    battleId: normalizedClaim.battleId,
    side: normalizedClaim.side,
    runId: normalizedClaim.runId,
    turnIndex: normalizedClaim.turnIndex,
    contextVersion: normalizedClaim.contextVersion,
    scope: normalizedClaim.scope,
    actionKind: normalizedClaim.actionKind,
    actionPayload: normalizedClaim.actionPayload,
  })
}

export const evaluateTacticOutputCapabilityRuntimeFreshnessTask1 = (
  input: TacticOutputCapabilityRuntimeFreshnessTask1Input,
): TacticOutputCapabilityRuntimeFreshnessTask1Result => {
  const normalizedClaim = normalizeClaim(input.claim)
  const normalizedRuntime = normalizeRuntime(input.runtime)
  const claimDigest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(normalizedClaim)

  let decision: TacticOutputCapabilityRuntimeFreshnessDecision

  if (input.consumedDigests.has(claimDigest)) {
    decision = 'duplicate'
  } else if (
    normalizedClaim.battleId !== normalizedRuntime.battleId
    || normalizedClaim.side !== normalizedRuntime.side
    || normalizedClaim.runId !== normalizedRuntime.runId
  ) {
    decision = 'wrong-runtime-binding'
  } else if (normalizedClaim.turnIndex !== normalizedRuntime.turnIndex) {
    decision = 'stale-turn'
  } else if (normalizedClaim.contextVersion !== normalizedRuntime.contextVersion) {
    decision = 'stale-context'
  } else if (!normalizedRuntime.dependencyValid) {
    decision = 'dependency-invalid'
  } else {
    decision = 'allow'
  }

  if (decision === 'allow' && input.consumeOnAllow !== false) {
    input.consumedDigests.markConsumed(claimDigest, {
      battleId: normalizedRuntime.battleId,
      runId: normalizedRuntime.runId,
      turnIndex: normalizedRuntime.turnIndex,
      contextVersion: normalizedRuntime.contextVersion,
      decision,
    })
  }

  return {
    decision,
    claimDigest,
    normalizedClaim,
    normalizedRuntime,
    artifactHash: sha256({
      domain: RESULT_ARTIFACT_DOMAIN,
      decision,
      claimDigest,
      normalizedClaim,
      normalizedRuntime,
    }),
  }
}
