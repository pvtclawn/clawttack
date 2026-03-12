import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs'
import { createHash } from 'node:crypto'

import {
  evaluateSubmitFencingGuard,
  type SubmitFencingInput,
  type SubmitFencingReason,
} from './single-writer-fencing.ts'
import type { TacticOutputCapabilityContextScope } from './tactic-output-capability-context-task1.ts'

export type TacticOutputCapabilityRuntimeSide = 'attacker' | 'defender'

export type TacticOutputCapabilityRuntimeFreshnessDecision =
  | 'allow'
  | 'duplicate'
  | 'wrong-runtime-binding'
  | 'stale-turn'
  | 'stale-context'
  | 'dependency-invalid'

export type TacticOutputCapabilityRuntimeFreshnessUncertaintyClass =
  | 'missing'
  | 'stale'
  | 'conflicting'
  | 'scope-mismatch'
  | 'epoch-regression'
  | 'timeout-suspected'

export type TacticOutputCapabilityRuntimeFreshnessRefusalReason =
  | SubmitFencingReason
  | 'sealed-scope'
  | 'missing-authority-witness'
  | 'stale-authority-witness'
  | 'witness-scope-mismatch'
  | 'missing-uncertainty-epoch'
  | 'stale-uncertainty-epoch'

export type TacticOutputCapabilityRuntimeFreshnessLeaseGuardDecision =
  | 'allow'
  | 'missing-renewal-generation'
  | 'stale-renewal-generation'
  | 'pause-revalidation-required'
  | 'witness-scope-mismatch'
  | 'invalid-authority-provenance'

export interface TacticOutputCapabilityRuntimeFreshnessTimerPolicy {
  suspicionTimeoutMs: number
  renewalWindowMs: number
  pauseRevalidateThresholdMs: number
  leaseGraceWindowMs: number
}

export interface TacticOutputCapabilityRuntimeFreshnessLeaseWitness {
  scopeKey: string
  authorityEpoch: number
  renewalGeneration: number
  authoritySource: string
}

export interface TacticOutputCapabilityRuntimeFreshnessLeaseGuardInput {
  expectedScopeKey: string
  expectedAuthoritySource: string
  timerPolicy: TacticOutputCapabilityRuntimeFreshnessTimerPolicy
  currentRenewalGeneration: number
  observedRenewalGeneration: number | null | undefined
  monotonicElapsedSinceAdmissionMs: number
  monotonicElapsedSinceRenewalMs: number
  wallClockObservedAtMs?: number
  wallClockNowMs?: number
  witness?: TacticOutputCapabilityRuntimeFreshnessLeaseWitness | null
}

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
  scopeKey: string
  battleId: string
  runId: string
  turnIndex: number
  contextVersion: number
  decision: TacticOutputCapabilityRuntimeFreshnessDecision
  writerId?: string
  writerToken?: number
}

export interface TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  has(digest: `0x${string}`): boolean
  markConsumed(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
  ): void
}

export interface TacticOutputCapabilityRuntimeFreshnessWriterAuthority {
  scopeKey: string
  writerId: string
  heldToken: number
  lockState: LockStateLike
}

export interface TacticOutputCapabilityRuntimeFreshnessAuthorityWitness {
  scopeKey: string
  authorityEpoch: number
  authoritySource: string
  resolvedUncertaintyClass?: TacticOutputCapabilityRuntimeFreshnessUncertaintyClass
}

export interface TacticOutputCapabilityRuntimeFreshnessFencedAppendResult {
  appended: boolean
  reason: TacticOutputCapabilityRuntimeFreshnessRefusalReason
}

export interface TacticOutputCapabilityRuntimeFreshnessFencedConsumedDigestStore
  extends TacticOutputCapabilityRuntimeFreshnessConsumedDigestStore {
  markConsumedWithAuthority(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
    authority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority,
  ): TacticOutputCapabilityRuntimeFreshnessFencedAppendResult
  markConsumedWithAuthorityWhileUnsealed(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
    authority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority,
    sealedScopes: TacticOutputCapabilityRuntimeFreshnessSealedScopeStore,
    observedUncertaintyEpoch: number | null | undefined,
  ): TacticOutputCapabilityRuntimeFreshnessFencedAppendResult
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
  scopeKey: string
  battleId: string
  runId: string
  turnIndex: number
  contextVersion: number
  writerId: string
  writerToken: number
  timestamp: string
  checksum: `0x${string}`
}

export interface TacticOutputCapabilityRuntimeFreshnessSealedScopeState {
  scopeKey: string
  sealed: boolean
  sealReason: string
  uncertaintyClass: TacticOutputCapabilityRuntimeFreshnessUncertaintyClass
  committedAuthorityEpoch: number
  uncertaintyEpoch: number
  authoritySource: string
  sealedAt: string
}

export interface TacticOutputCapabilityRuntimeFreshnessSealedScopeFile {
  schemaVersion: number
  states: TacticOutputCapabilityRuntimeFreshnessSealedScopeState[]
}

export interface TacticOutputCapabilityRuntimeFreshnessFileBackedStoreOptions {
  filePath: string
  now?: () => string
}

export interface TacticOutputCapabilityRuntimeFreshnessSealedScopeStore {
  isSealed(scopeKey: string): boolean
  getUncertaintyEpoch(scopeKey: string): number
  getCommittedAuthorityEpoch(scopeKey: string): number
  getScopeState(scopeKey: string): TacticOutputCapabilityRuntimeFreshnessSealedScopeState | undefined
}

export interface TacticOutputCapabilityRuntimeFreshnessMutableSealedScopeStore
  extends TacticOutputCapabilityRuntimeFreshnessSealedScopeStore {
  sealScope(input: {
    scopeKey: string
    sealReason: string
    authorityEpoch: number
    authoritySource: string
    uncertaintyClass: TacticOutputCapabilityRuntimeFreshnessUncertaintyClass
    uncertaintyEpoch: number
  }): void
  unsealScope(input: {
    scopeKey: string
    witness: TacticOutputCapabilityRuntimeFreshnessAuthorityWitness | null | undefined
  }): {
    unsealed: boolean
    reason:
      | 'pass'
      | 'missing-authority-witness'
      | 'stale-authority-witness'
      | 'witness-scope-mismatch'
      | 'invalid-authority-provenance'
      | 'unresolved-contradiction'
  }
}

export type TacticOutputCapabilityRuntimeFreshnessResumeBarrierDecision =
  | 'pass'
  | 'missing-recovery-snapshot'
  | 'mixed-snapshot-stale'
  | 'authority-source-mismatch'

export interface TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState {
  scopeKey: string
  quarantined: boolean
  quarantineReason: string
  quarantineEpoch: number
  quarantineGeneration: number
  authoritySource: string
  quarantinedAt: string
}

export interface TacticOutputCapabilityRuntimeFreshnessResumeQuarantineFile {
  schemaVersion: number
  states: TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState[]
}

export interface TacticOutputCapabilityRuntimeFreshnessResumeWorkItem {
  scopeKey: string
  observedAuthorityEpoch: number
  observedRenewalGeneration: number
  observedAuthoritySource: string
}

export interface TacticOutputCapabilityRuntimeFreshnessRecoverySnapshot {
  scopeKey: string
  authorityEpoch: number
  renewalGeneration: number
  authoritySource: string
}

export interface TacticOutputCapabilityRuntimeFreshnessResumeQuarantineStore {
  isQuarantined(scopeKey: string): boolean
  getScopeState(scopeKey: string): TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState | undefined
}

export interface TacticOutputCapabilityRuntimeFreshnessMutableResumeQuarantineStore
  extends TacticOutputCapabilityRuntimeFreshnessResumeQuarantineStore {
  quarantineScope(input: {
    scopeKey: string
    quarantineReason: string
    authorityEpoch: number
    renewalGeneration: number
    authoritySource: string
  }): void
  releaseScopeIfCurrent(input: {
    workItem: TacticOutputCapabilityRuntimeFreshnessResumeWorkItem
    snapshot: TacticOutputCapabilityRuntimeFreshnessRecoverySnapshot | null | undefined
  }): {
    released: boolean
    reason: TacticOutputCapabilityRuntimeFreshnessResumeBarrierDecision
  }
}

type LockStateLike = SubmitFencingInput['lockState']

const CLAIM_DIGEST_DOMAIN = 'clawttack/tactic-output-capability-runtime-freshness-task1/claim-digest'
const RESULT_ARTIFACT_DOMAIN = 'clawttack/tactic-output-capability-runtime-freshness-task1/result'
const LEDGER_RECORD_DOMAIN = 'clawttack/tactic-output-capability-runtime-freshness-task1/ledger-record'
const SEALED_SCOPE_FILE_SCHEMA_VERSION = 3
const RESUME_QUARANTINE_FILE_SCHEMA_VERSION = 1
const LEDGER_SCHEMA_VERSION = 2
const UNFENCED_WRITER_ID = 'unfenced'
const UNFENCED_WRITER_TOKEN = 0

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
  implements TacticOutputCapabilityRuntimeFreshnessFencedConsumedDigestStore {
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
        scopeKey: record.scopeKey,
        battleId: record.battleId,
        runId: record.runId,
        turnIndex: record.turnIndex,
        contextVersion: record.contextVersion,
        decision: 'allow',
        writerId: record.writerId,
        writerToken: record.writerToken,
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
    this.appendDurably(digest, metadata)
  }

  markConsumedWithAuthority(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
    authority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority,
  ): TacticOutputCapabilityRuntimeFreshnessFencedAppendResult {
    this.assertLoaded()

    const normalizedMetadata = normalizeConsumedMetadata(metadata)
    const normalizedAuthority = normalizeWriterAuthority(authority)
    const fencing = evaluateSubmitFencingGuard({
      expectedScopeKey: normalizedMetadata.scopeKey,
      runnerId: normalizedAuthority.writerId,
      heldToken: normalizedAuthority.heldToken,
      lockState: normalizedAuthority.lockState,
    })

    if (!fencing.allowSubmit) {
      return { appended: false, reason: fencing.reason }
    }

    this.appendDurably(digest, {
      ...normalizedMetadata,
      writerId: normalizedAuthority.writerId,
      writerToken: normalizedAuthority.heldToken,
    })

    return { appended: true, reason: 'pass' }
  }

  markConsumedWithAuthorityWhileUnsealed(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
    authority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority,
    sealedScopes: TacticOutputCapabilityRuntimeFreshnessSealedScopeStore,
    observedUncertaintyEpoch: number | null | undefined,
  ): TacticOutputCapabilityRuntimeFreshnessFencedAppendResult {
    this.assertLoaded()

    if (observedUncertaintyEpoch === null || observedUncertaintyEpoch === undefined) {
      return { appended: false, reason: 'missing-uncertainty-epoch' }
    }

    const normalizedMetadata = normalizeConsumedMetadata(metadata)
    const currentUncertaintyEpoch = sealedScopes.getUncertaintyEpoch(normalizedMetadata.scopeKey)
    if (observedUncertaintyEpoch !== currentUncertaintyEpoch) {
      return { appended: false, reason: 'stale-uncertainty-epoch' }
    }

    if (sealedScopes.isSealed(normalizedMetadata.scopeKey)) {
      return { appended: false, reason: 'sealed-scope' }
    }

    return this.markConsumedWithAuthority(digest, normalizedMetadata, authority)
  }

  private appendDurably(
    digest: `0x${string}`,
    metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
  ): void {
    const normalizedMetadata = normalizeConsumedMetadata(metadata)
    const record = createLedgerRecord({
      digest,
      scopeKey: normalizedMetadata.scopeKey,
      battleId: normalizedMetadata.battleId,
      runId: normalizedMetadata.runId,
      turnIndex: normalizedMetadata.turnIndex,
      contextVersion: normalizedMetadata.contextVersion,
      writerId: normalizedMetadata.writerId ?? UNFENCED_WRITER_ID,
      writerToken: normalizedMetadata.writerToken ?? UNFENCED_WRITER_TOKEN,
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

    this.#digests.set(digest, {
      ...normalizedMetadata,
      writerId: normalizedMetadata.writerId ?? UNFENCED_WRITER_ID,
      writerToken: normalizedMetadata.writerToken ?? UNFENCED_WRITER_TOKEN,
    })
  }

  private assertLoaded(): void {
    if (!this.#loaded) {
      throw new Error('Freshness ledger must be loaded before use')
    }
  }
}

export class FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore
  implements TacticOutputCapabilityRuntimeFreshnessMutableSealedScopeStore {
  readonly #filePath: string
  readonly #now: () => string
  readonly #states = new Map<string, TacticOutputCapabilityRuntimeFreshnessSealedScopeState>()
  #loaded = false

  constructor(options: TacticOutputCapabilityRuntimeFreshnessFileBackedStoreOptions) {
    this.#filePath = options.filePath
    this.#now = options.now ?? (() => new Date().toISOString())
  }

  load(): void {
    this.#states.clear()

    if (!existsSync(this.#filePath)) {
      this.#loaded = true
      return
    }

    const raw = readFileSync(this.#filePath, 'utf8')
    if (raw.length === 0) {
      this.#loaded = true
      return
    }

    const parsed = JSON.parse(raw) as Partial<TacticOutputCapabilityRuntimeFreshnessSealedScopeFile>
    if (parsed.schemaVersion !== SEALED_SCOPE_FILE_SCHEMA_VERSION || !Array.isArray(parsed.states)) {
      throw new Error('Freshness sealed-scope file shape is invalid')
    }

    for (const entry of parsed.states) {
      const state = validateSealedScopeState(entry)
      this.#states.set(state.scopeKey, state)
    }

    this.#loaded = true
  }

  isSealed(scopeKey: string): boolean {
    this.assertLoaded()
    return this.#states.get(normalizeScopeKey(scopeKey))?.sealed === true
  }

  getUncertaintyEpoch(scopeKey: string): number {
    this.assertLoaded()
    return this.#states.get(normalizeScopeKey(scopeKey))?.uncertaintyEpoch ?? 0
  }

  getCommittedAuthorityEpoch(scopeKey: string): number {
    this.assertLoaded()
    return this.#states.get(normalizeScopeKey(scopeKey))?.committedAuthorityEpoch ?? 0
  }

  getScopeState(scopeKey: string): TacticOutputCapabilityRuntimeFreshnessSealedScopeState | undefined {
    this.assertLoaded()
    const state = this.#states.get(normalizeScopeKey(scopeKey))
    return state === undefined ? undefined : { ...state }
  }

  sealScope(input: {
    scopeKey: string
    sealReason: string
    authorityEpoch: number
    authoritySource: string
    uncertaintyClass: TacticOutputCapabilityRuntimeFreshnessUncertaintyClass
    uncertaintyEpoch: number
  }): void {
    this.assertLoaded()
    const state = createSealedScopeState({
      scopeKey: input.scopeKey,
      sealReason: input.sealReason,
      authorityEpoch: input.authorityEpoch,
      authoritySource: input.authoritySource,
      uncertaintyClass: input.uncertaintyClass,
      uncertaintyEpoch: input.uncertaintyEpoch,
      sealedAt: this.#now(),
    })
    this.#states.set(state.scopeKey, state)
    this.persist()
  }

  unsealScope(input: {
    scopeKey: string
    witness: TacticOutputCapabilityRuntimeFreshnessAuthorityWitness | null | undefined
  }): {
    unsealed: boolean
    reason:
      | 'pass'
      | 'missing-authority-witness'
      | 'stale-authority-witness'
      | 'witness-scope-mismatch'
      | 'invalid-authority-provenance'
      | 'unresolved-contradiction'
  } {
    this.assertLoaded()

    const normalizedScopeKey = normalizeScopeKey(input.scopeKey)
    const current = this.#states.get(normalizedScopeKey)
    if (!current?.sealed) {
      return { unsealed: true, reason: 'pass' }
    }

    if (!input.witness) {
      return { unsealed: false, reason: 'missing-authority-witness' }
    }

    const witness = normalizeAuthorityWitness(input.witness)
    if (witness.scopeKey !== normalizedScopeKey) {
      return { unsealed: false, reason: 'witness-scope-mismatch' }
    }

    if (witness.authoritySource !== current.authoritySource) {
      return { unsealed: false, reason: 'invalid-authority-provenance' }
    }

    const requiredEpoch = Math.max(current.committedAuthorityEpoch, current.uncertaintyEpoch)
    if (witness.authorityEpoch <= requiredEpoch) {
      return { unsealed: false, reason: 'stale-authority-witness' }
    }

    if (
      (current.uncertaintyClass === 'conflicting'
        || current.uncertaintyClass === 'epoch-regression'
        || current.uncertaintyClass === 'scope-mismatch')
      && witness.resolvedUncertaintyClass !== current.uncertaintyClass
    ) {
      return { unsealed: false, reason: 'unresolved-contradiction' }
    }

    this.#states.set(normalizedScopeKey, {
      ...current,
      sealed: false,
      committedAuthorityEpoch: witness.authorityEpoch,
    })
    this.persist()
    return { unsealed: true, reason: 'pass' }
  }

  private persist(): void {
    const file: TacticOutputCapabilityRuntimeFreshnessSealedScopeFile = {
      schemaVersion: SEALED_SCOPE_FILE_SCHEMA_VERSION,
      states: Array.from(this.#states.values()).sort((a, b) => a.scopeKey.localeCompare(b.scopeKey)),
    }

    writeFileSync(this.#filePath, `${stableStringify(file)}\n`)
  }

  private assertLoaded(): void {
    if (!this.#loaded) {
      throw new Error('Freshness sealed-scope store must be loaded before use')
    }
  }
}

export class FileBackedTacticOutputCapabilityRuntimeFreshnessResumeQuarantineStore
  implements TacticOutputCapabilityRuntimeFreshnessMutableResumeQuarantineStore {
  readonly #filePath: string
  readonly #now: () => string
  readonly #states = new Map<string, TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState>()
  #loaded = false

  constructor(options: TacticOutputCapabilityRuntimeFreshnessFileBackedStoreOptions) {
    this.#filePath = options.filePath
    this.#now = options.now ?? (() => new Date().toISOString())
  }

  load(): void {
    this.#states.clear()

    if (!existsSync(this.#filePath)) {
      this.#loaded = true
      return
    }

    const raw = readFileSync(this.#filePath, 'utf8')
    if (raw.length === 0) {
      this.#loaded = true
      return
    }

    const parsed = JSON.parse(raw) as Partial<TacticOutputCapabilityRuntimeFreshnessResumeQuarantineFile>
    if (parsed.schemaVersion !== RESUME_QUARANTINE_FILE_SCHEMA_VERSION || !Array.isArray(parsed.states)) {
      throw new Error('Freshness resume-quarantine file shape is invalid')
    }

    for (const entry of parsed.states) {
      const state = validateResumeQuarantineState(entry)
      this.#states.set(state.scopeKey, state)
    }

    this.#loaded = true
  }

  isQuarantined(scopeKey: string): boolean {
    this.assertLoaded()
    return this.#states.get(normalizeScopeKey(scopeKey))?.quarantined === true
  }

  getScopeState(scopeKey: string): TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState | undefined {
    this.assertLoaded()
    const state = this.#states.get(normalizeScopeKey(scopeKey))
    return state === undefined ? undefined : { ...state }
  }

  quarantineScope(input: {
    scopeKey: string
    quarantineReason: string
    authorityEpoch: number
    renewalGeneration: number
    authoritySource: string
  }): void {
    this.assertLoaded()
    const state = createResumeQuarantineState({
      scopeKey: input.scopeKey,
      quarantineReason: input.quarantineReason,
      authorityEpoch: input.authorityEpoch,
      renewalGeneration: input.renewalGeneration,
      authoritySource: input.authoritySource,
      quarantinedAt: this.#now(),
    })
    this.#states.set(state.scopeKey, state)
    this.persist()
  }

  releaseScopeIfCurrent(input: {
    workItem: TacticOutputCapabilityRuntimeFreshnessResumeWorkItem
    snapshot: TacticOutputCapabilityRuntimeFreshnessRecoverySnapshot | null | undefined
  }): { released: boolean, reason: TacticOutputCapabilityRuntimeFreshnessResumeBarrierDecision } {
    this.assertLoaded()
    const decision = evaluateTacticOutputCapabilityRuntimeFreshnessResumeBarrier({
      workItem: input.workItem,
      snapshot: input.snapshot,
    })

    if (decision !== 'pass') {
      return { released: false, reason: decision }
    }

    const workItem = normalizeResumeWorkItem(input.workItem)
    const snapshot = normalizeRecoverySnapshot(input.snapshot!)
    this.#states.set(workItem.scopeKey, {
      scopeKey: workItem.scopeKey,
      quarantined: false,
      quarantineReason: 'released',
      quarantineEpoch: snapshot.authorityEpoch,
      quarantineGeneration: snapshot.renewalGeneration,
      authoritySource: snapshot.authoritySource,
      quarantinedAt: this.#now(),
    })
    this.persist()
    return { released: true, reason: 'pass' }
  }

  private persist(): void {
    const file: TacticOutputCapabilityRuntimeFreshnessResumeQuarantineFile = {
      schemaVersion: RESUME_QUARANTINE_FILE_SCHEMA_VERSION,
      states: Array.from(this.#states.values()).sort((a, b) => a.scopeKey.localeCompare(b.scopeKey)),
    }
    writeFileSync(this.#filePath, `${stableStringify(file)}\n`)
  }

  private assertLoaded(): void {
    if (!this.#loaded) {
      throw new Error('Freshness resume-quarantine store must be loaded before use')
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

const normalizeScopeKey = (value: string): string => normalizeToken(value)

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

const normalizeConsumedMetadata = (
  metadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
): TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata => ({
  scopeKey: normalizeScopeKey(metadata.scopeKey),
  battleId: normalizeToken(metadata.battleId),
  runId: normalizeToken(metadata.runId),
  turnIndex: metadata.turnIndex,
  contextVersion: metadata.contextVersion,
  decision: metadata.decision,
  writerId: metadata.writerId === undefined ? undefined : normalizeToken(metadata.writerId),
  writerToken: metadata.writerToken,
})

const normalizeWriterAuthority = (
  authority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority,
): TacticOutputCapabilityRuntimeFreshnessWriterAuthority => ({
  scopeKey: normalizeScopeKey(authority.scopeKey),
  writerId: normalizeToken(authority.writerId),
  heldToken: authority.heldToken,
  lockState: authority.lockState === null || authority.lockState === undefined
    ? authority.lockState
    : {
        scopeKey: normalizeScopeKey(authority.lockState.scopeKey),
        ownerId: normalizeToken(authority.lockState.ownerId),
        activeToken: authority.lockState.activeToken,
        tokenFloor: authority.lockState.tokenFloor,
      },
})

const normalizeAuthorityWitness = (
  witness: TacticOutputCapabilityRuntimeFreshnessAuthorityWitness,
): TacticOutputCapabilityRuntimeFreshnessAuthorityWitness => ({
  scopeKey: normalizeScopeKey(witness.scopeKey),
  authorityEpoch: witness.authorityEpoch,
  authoritySource: normalizeToken(witness.authoritySource),
  resolvedUncertaintyClass: witness.resolvedUncertaintyClass,
})

const createLedgerChecksum = (record: Omit<TacticOutputCapabilityRuntimeFreshnessLedgerRecord, 'checksum'>): `0x${string}` => sha256({
  domain: LEDGER_RECORD_DOMAIN,
  schemaVersion: record.schemaVersion,
  digest: record.digest,
  scopeKey: record.scopeKey,
  battleId: record.battleId,
  runId: record.runId,
  turnIndex: record.turnIndex,
  contextVersion: record.contextVersion,
  writerId: record.writerId,
  writerToken: record.writerToken,
  timestamp: record.timestamp,
})

const createLedgerRecord = (input: {
  digest: `0x${string}`
  scopeKey: string
  battleId: string
  runId: string
  turnIndex: number
  contextVersion: number
  writerId: string
  writerToken: number
  timestamp: string
}): TacticOutputCapabilityRuntimeFreshnessLedgerRecord => {
  const baseRecord = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    digest: input.digest,
    scopeKey: normalizeScopeKey(input.scopeKey),
    battleId: normalizeToken(input.battleId),
    runId: normalizeToken(input.runId),
    turnIndex: input.turnIndex,
    contextVersion: input.contextVersion,
    writerId: normalizeToken(input.writerId),
    writerToken: input.writerToken,
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
    || typeof record.scopeKey !== 'string'
    || typeof record.battleId !== 'string'
    || typeof record.runId !== 'string'
    || typeof record.turnIndex !== 'number'
    || typeof record.contextVersion !== 'number'
    || typeof record.writerId !== 'string'
    || typeof record.writerToken !== 'number'
    || typeof record.timestamp !== 'string'
    || typeof record.checksum !== 'string'
  ) {
    throw new Error('Freshness ledger record shape is invalid')
  }

  const normalizedRecord: TacticOutputCapabilityRuntimeFreshnessLedgerRecord = {
    schemaVersion: record.schemaVersion,
    digest: record.digest as `0x${string}`,
    scopeKey: normalizeScopeKey(record.scopeKey),
    battleId: normalizeToken(record.battleId),
    runId: normalizeToken(record.runId),
    turnIndex: record.turnIndex,
    contextVersion: record.contextVersion,
    writerId: normalizeToken(record.writerId),
    writerToken: record.writerToken,
    timestamp: record.timestamp,
    checksum: record.checksum as `0x${string}`,
  }

  const expectedChecksum = createLedgerChecksum({
    schemaVersion: normalizedRecord.schemaVersion,
    digest: normalizedRecord.digest,
    scopeKey: normalizedRecord.scopeKey,
    battleId: normalizedRecord.battleId,
    runId: normalizedRecord.runId,
    turnIndex: normalizedRecord.turnIndex,
    contextVersion: normalizedRecord.contextVersion,
    writerId: normalizedRecord.writerId,
    writerToken: normalizedRecord.writerToken,
    timestamp: normalizedRecord.timestamp,
  })

  if (normalizedRecord.checksum !== expectedChecksum) {
    throw new Error('Freshness ledger checksum mismatch')
  }

  return normalizedRecord
}

const normalizeResumeWorkItem = (
  workItem: TacticOutputCapabilityRuntimeFreshnessResumeWorkItem,
): TacticOutputCapabilityRuntimeFreshnessResumeWorkItem => ({
  scopeKey: normalizeScopeKey(workItem.scopeKey),
  observedAuthorityEpoch: workItem.observedAuthorityEpoch,
  observedRenewalGeneration: workItem.observedRenewalGeneration,
  observedAuthoritySource: normalizeToken(workItem.observedAuthoritySource),
})

const normalizeRecoverySnapshot = (
  snapshot: TacticOutputCapabilityRuntimeFreshnessRecoverySnapshot,
): TacticOutputCapabilityRuntimeFreshnessRecoverySnapshot => ({
  scopeKey: normalizeScopeKey(snapshot.scopeKey),
  authorityEpoch: snapshot.authorityEpoch,
  renewalGeneration: snapshot.renewalGeneration,
  authoritySource: normalizeToken(snapshot.authoritySource),
})

const createResumeQuarantineState = (input: {
  scopeKey: string
  quarantineReason: string
  authorityEpoch: number
  renewalGeneration: number
  authoritySource: string
  quarantinedAt: string
}): TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState => ({
  scopeKey: normalizeScopeKey(input.scopeKey),
  quarantined: true,
  quarantineReason: normalizeToken(input.quarantineReason),
  quarantineEpoch: input.authorityEpoch,
  quarantineGeneration: input.renewalGeneration,
  authoritySource: normalizeToken(input.authoritySource),
  quarantinedAt: input.quarantinedAt,
})

const validateResumeQuarantineState = (
  state: Partial<TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState>,
): TacticOutputCapabilityRuntimeFreshnessResumeQuarantineState => {
  if (
    typeof state.scopeKey !== 'string'
    || typeof state.quarantined !== 'boolean'
    || typeof state.quarantineReason !== 'string'
    || typeof state.quarantineEpoch !== 'number'
    || typeof state.quarantineGeneration !== 'number'
    || typeof state.authoritySource !== 'string'
    || typeof state.quarantinedAt !== 'string'
  ) {
    throw new Error('Freshness resume-quarantine state shape is invalid')
  }

  return {
    scopeKey: normalizeScopeKey(state.scopeKey),
    quarantined: state.quarantined,
    quarantineReason: normalizeToken(state.quarantineReason),
    quarantineEpoch: state.quarantineEpoch,
    quarantineGeneration: state.quarantineGeneration,
    authoritySource: normalizeToken(state.authoritySource),
    quarantinedAt: state.quarantinedAt,
  }
}

const createSealedScopeState = (input: {
  scopeKey: string
  sealReason: string
  authorityEpoch: number
  authoritySource: string
  uncertaintyClass: TacticOutputCapabilityRuntimeFreshnessUncertaintyClass
  uncertaintyEpoch: number
  sealedAt: string
}): TacticOutputCapabilityRuntimeFreshnessSealedScopeState => ({
  scopeKey: normalizeScopeKey(input.scopeKey),
  sealed: true,
  sealReason: normalizeToken(input.sealReason),
  uncertaintyClass: input.uncertaintyClass,
  committedAuthorityEpoch: input.authorityEpoch,
  uncertaintyEpoch: input.uncertaintyEpoch,
  authoritySource: normalizeToken(input.authoritySource),
  sealedAt: input.sealedAt,
})

const validateSealedScopeState = (
  state: Partial<TacticOutputCapabilityRuntimeFreshnessSealedScopeState>,
): TacticOutputCapabilityRuntimeFreshnessSealedScopeState => {
  if (
    typeof state.scopeKey !== 'string'
    || typeof state.sealed !== 'boolean'
    || typeof state.sealReason !== 'string'
    || typeof state.uncertaintyClass !== 'string'
    || typeof state.committedAuthorityEpoch !== 'number'
    || typeof state.uncertaintyEpoch !== 'number'
    || typeof state.authoritySource !== 'string'
    || typeof state.sealedAt !== 'string'
  ) {
    throw new Error('Freshness sealed-scope state shape is invalid')
  }

  return {
    scopeKey: normalizeScopeKey(state.scopeKey),
    sealed: state.sealed,
    sealReason: normalizeToken(state.sealReason),
    uncertaintyClass: state.uncertaintyClass as TacticOutputCapabilityRuntimeFreshnessUncertaintyClass,
    committedAuthorityEpoch: state.committedAuthorityEpoch,
    uncertaintyEpoch: state.uncertaintyEpoch,
    authoritySource: normalizeToken(state.authoritySource),
    sealedAt: state.sealedAt,
  }
}

export const buildTacticOutputCapabilityRuntimeFreshnessScopeKey = (input: {
  battleId: string
  side: TacticOutputCapabilityRuntimeSide
  runId: string
}): string => [normalizeToken(input.battleId), input.side, normalizeToken(input.runId)].join(':')

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

export const evaluateTacticOutputCapabilityRuntimeFreshnessResumeBarrier = (
  input: {
    workItem: TacticOutputCapabilityRuntimeFreshnessResumeWorkItem
    snapshot: TacticOutputCapabilityRuntimeFreshnessRecoverySnapshot | null | undefined
  },
): TacticOutputCapabilityRuntimeFreshnessResumeBarrierDecision => {
  if (!input.snapshot) {
    return 'missing-recovery-snapshot'
  }

  const workItem = normalizeResumeWorkItem(input.workItem)
  const snapshot = normalizeRecoverySnapshot(input.snapshot)

  if (workItem.scopeKey !== snapshot.scopeKey) {
    return 'mixed-snapshot-stale'
  }

  if (workItem.observedAuthoritySource !== snapshot.authoritySource) {
    return 'authority-source-mismatch'
  }

  if (
    workItem.observedAuthorityEpoch !== snapshot.authorityEpoch
    || workItem.observedRenewalGeneration !== snapshot.renewalGeneration
  ) {
    return 'mixed-snapshot-stale'
  }

  return 'pass'
}

export const evaluateTacticOutputCapabilityRuntimeFreshnessLeaseGuard = (
  input: TacticOutputCapabilityRuntimeFreshnessLeaseGuardInput,
): TacticOutputCapabilityRuntimeFreshnessLeaseGuardDecision => {
  const expectedScopeKey = normalizeScopeKey(input.expectedScopeKey)
  const expectedAuthoritySource = normalizeToken(input.expectedAuthoritySource)

  const timerPolicy: TacticOutputCapabilityRuntimeFreshnessTimerPolicy = {
    suspicionTimeoutMs: input.timerPolicy.suspicionTimeoutMs,
    renewalWindowMs: input.timerPolicy.renewalWindowMs,
    pauseRevalidateThresholdMs: input.timerPolicy.pauseRevalidateThresholdMs,
    leaseGraceWindowMs: input.timerPolicy.leaseGraceWindowMs,
  }

  if (input.observedRenewalGeneration === null || input.observedRenewalGeneration === undefined) {
    return 'missing-renewal-generation'
  }

  if (input.observedRenewalGeneration !== input.currentRenewalGeneration) {
    return 'stale-renewal-generation'
  }

  if (input.monotonicElapsedSinceAdmissionMs > timerPolicy.pauseRevalidateThresholdMs) {
    return 'pause-revalidation-required'
  }

  if (
    input.monotonicElapsedSinceRenewalMs
    > timerPolicy.suspicionTimeoutMs + timerPolicy.leaseGraceWindowMs
  ) {
    return 'stale-renewal-generation'
  }

  if (input.witness) {
    const witness: TacticOutputCapabilityRuntimeFreshnessLeaseWitness = {
      scopeKey: normalizeScopeKey(input.witness.scopeKey),
      authorityEpoch: input.witness.authorityEpoch,
      renewalGeneration: input.witness.renewalGeneration,
      authoritySource: normalizeToken(input.witness.authoritySource),
    }

    if (witness.scopeKey !== expectedScopeKey) {
      return 'witness-scope-mismatch'
    }

    if (witness.authoritySource !== expectedAuthoritySource) {
      return 'invalid-authority-provenance'
    }

    if (witness.renewalGeneration !== input.currentRenewalGeneration) {
      return 'stale-renewal-generation'
    }
  }

  return 'allow'
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
      scopeKey: buildTacticOutputCapabilityRuntimeFreshnessScopeKey(normalizedRuntime),
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
