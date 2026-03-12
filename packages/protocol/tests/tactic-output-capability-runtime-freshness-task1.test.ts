import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildTacticOutputCapabilityRuntimeFreshnessScopeKey,
  computeTacticOutputCapabilityRuntimeClaimDigestTask1,
  evaluateTacticOutputCapabilityRuntimeFreshnessTask1,
  FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore,
  InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore,
  type TacticOutputCapabilityRuntimeFreshnessClaim,
  type TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata,
  type TacticOutputCapabilityRuntimeFreshnessState,
  type TacticOutputCapabilityRuntimeFreshnessWriterAuthority,
} from '../src/tactic-output-capability-runtime-freshness-task1.ts'

describe('tactic output capability runtime freshness task1', () => {
  const baseClaim: TacticOutputCapabilityRuntimeFreshnessClaim = {
    schemaVersion: 1,
    battleId: ' Battle-027 ',
    side: 'attacker',
    runId: ' run-9 ',
    turnIndex: 7,
    contextVersion: 3,
    scope: {
      scopeClass: 'battle',
      namespace: ' Arena-Alpha ',
      scopeId: ' Battle-027 ',
      scopeVersion: 3,
    },
    actionKind: ' submit move ',
    actionPayload: {
      target: 'vault',
      move: 'extract-proof',
      params: {
        strategy: 'quiet',
        budget: 2,
      },
    },
  }

  const baseRuntime: TacticOutputCapabilityRuntimeFreshnessState = {
    battleId: 'battle-027',
    side: 'attacker',
    runId: 'run-9',
    turnIndex: 7,
    contextVersion: 3,
    dependencyValid: true,
  }

  const baseScopeKey = buildTacticOutputCapabilityRuntimeFreshnessScopeKey(baseRuntime)

  const baseMetadata: TacticOutputCapabilityRuntimeFreshnessConsumedDigestMetadata = {
    scopeKey: baseScopeKey,
    battleId: 'battle-027',
    runId: 'run-9',
    turnIndex: 7,
    contextVersion: 3,
    decision: 'allow',
  }

  const validAuthority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority = {
    scopeKey: baseScopeKey,
    writerId: 'runner-a',
    heldToken: 7,
    lockState: {
      scopeKey: baseScopeKey,
      ownerId: 'runner-a',
      activeToken: 7,
      tokenFloor: 7,
    },
  }

  it('produces the same digest for semantically identical claims with different serialization', () => {
    const a = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)
    const b = computeTacticOutputCapabilityRuntimeClaimDigestTask1({
      ...baseClaim,
      battleId: 'battle-027',
      runId: 'run-9',
      actionKind: 'submit move',
      actionPayload: {
        params: {
          budget: 2,
          strategy: 'quiet',
        },
        move: 'extract-proof',
        target: 'vault',
      },
      scope: {
        scopeClass: 'battle',
        namespace: 'arena-alpha',
        scopeId: 'battle-027',
        scopeVersion: 3,
      },
    })

    expect(a).toBe(b)
  })

  it('changes digest when a runtime-critical binding changes', () => {
    const a = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)
    const b = computeTacticOutputCapabilityRuntimeClaimDigestTask1({
      ...baseClaim,
      runId: 'run-10',
    })

    expect(a).not.toBe(b)
  })

  it('allows a matching fresh claim and marks it consumed', () => {
    const store = new InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore()

    const result = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: store,
    })

    expect(result.decision).toBe('allow')
    expect(store.has(result.claimDigest)).toBe(true)
  })

  it('denies a duplicate after prior consumption', () => {
    const store = new InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore()

    const first = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: store,
    })
    const second = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: store,
    })

    expect(first.decision).toBe('allow')
    expect(second.decision).toBe('duplicate')
    expect(second.claimDigest).toBe(first.claimDigest)
  })

  it('denies cross-run replay as wrong-runtime-binding', () => {
    const store = new InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore()

    const result = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: {
        ...baseRuntime,
        runId: 'run-10',
      },
      consumedDigests: store,
      consumeOnAllow: false,
    })

    expect(result.decision).toBe('wrong-runtime-binding')
  })

  it('denies turn mismatch as stale-turn', () => {
    const store = new InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore()

    const result = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: {
        ...baseRuntime,
        turnIndex: 8,
      },
      consumedDigests: store,
      consumeOnAllow: false,
    })

    expect(result.decision).toBe('stale-turn')
  })

  it('denies context mismatch as stale-context', () => {
    const store = new InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore()

    const result = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: {
        ...baseRuntime,
        contextVersion: 4,
      },
      consumedDigests: store,
      consumeOnAllow: false,
    })

    expect(result.decision).toBe('stale-context')
  })

  it('denies invalid dependencies deterministically', () => {
    const store = new InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore()

    const result = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: {
        ...baseRuntime,
        dependencyValid: false,
      },
      consumedDigests: store,
      consumeOnAllow: false,
    })

    expect(result.decision).toBe('dependency-invalid')
  })

  it('fails closed if a file-backed ledger is used before load', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    expect(() => store.has(digest)).toThrow('Freshness ledger must be loaded before use')
  })

  it('survives restart and denies a duplicate with a file-backed ledger', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')

    const firstStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({
      filePath,
      now: () => '2026-03-12T19:22:00.000Z',
    })
    firstStore.load()

    const first = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: firstStore,
    })

    const secondStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    secondStore.load()

    const second = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: secondStore,
      consumeOnAllow: false,
    })

    expect(first.decision).toBe('allow')
    expect(second.decision).toBe('duplicate')
    expect(second.claimDigest).toBe(first.claimDigest)
  })

  it('rejects a ledger with a trailing partial record', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    writeFileSync(filePath, '{"schemaVersion":2')

    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })

    expect(() => store.load()).toThrow('Freshness ledger has trailing partial record')
  })

  it('rejects checksum corruption deterministically', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')

    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({
      filePath,
      now: () => '2026-03-12T19:22:00.000Z',
    })
    store.load()
    evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: store,
    })

    const corrupted = readFileSync(filePath, 'utf8').replace('battle-027', 'battle-999')
    writeFileSync(filePath, corrupted)

    const reloaded = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    expect(() => reloaded.load()).toThrow('Freshness ledger checksum mismatch')
  })

  it('treats duplicate valid rows as a stable consumed set', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')

    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({
      filePath,
      now: () => '2026-03-12T19:22:00.000Z',
    })
    store.load()
    const first = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: store,
    })

    const existing = readFileSync(filePath, 'utf8')
    writeFileSync(filePath, `${existing}${existing}`)

    const reloaded = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    reloaded.load()

    expect(reloaded.has(first.claimDigest)).toBe(true)
  })

  it('fails closed on missing authority state for fenced append', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)
    store.load()

    const result = store.markConsumedWithAuthority(digest, baseMetadata, {
      ...validAuthority,
      lockState: null,
    })

    expect(result).toEqual({ appended: false, reason: 'missing-lock-state' })
    expect(store.has(digest)).toBe(false)
  })

  it('denies fenced append for a stale token', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)
    store.load()

    const result = store.markConsumedWithAuthority(digest, baseMetadata, {
      ...validAuthority,
      heldToken: 6,
      lockState: {
        scopeKey: baseScopeKey,
        ownerId: 'runner-a',
        activeToken: 7,
        tokenFloor: 7,
      },
    })

    expect(result).toEqual({ appended: false, reason: 'stale-fencing-token' })
    expect(store.has(digest)).toBe(false)
  })

  it('denies fenced append on scope mismatch', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)
    store.load()

    const wrongScopeKey = buildTacticOutputCapabilityRuntimeFreshnessScopeKey({
      battleId: 'battle-027',
      side: 'defender',
      runId: 'run-9',
    })

    const result = store.markConsumedWithAuthority(digest, baseMetadata, {
      scopeKey: wrongScopeKey,
      writerId: 'runner-a',
      heldToken: 7,
      lockState: {
        scopeKey: wrongScopeKey,
        ownerId: 'runner-a',
        activeToken: 7,
        tokenFloor: 7,
      },
    })

    expect(result).toEqual({ appended: false, reason: 'lock-scope-mismatch' })
    expect(store.has(digest)).toBe(false)
  })

  it('denies fenced append on token regression', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    const store = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)
    store.load()

    const result = store.markConsumedWithAuthority(digest, baseMetadata, {
      ...validAuthority,
      heldToken: 5,
      lockState: {
        scopeKey: baseScopeKey,
        ownerId: 'runner-a',
        activeToken: 5,
        tokenFloor: 7,
      },
    })

    expect(result).toEqual({ appended: false, reason: 'token-regression-detected' })
    expect(store.has(digest)).toBe(false)
  })

  it('embeds writer token in durable records for valid fenced append and preserves duplicate denial after restart', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-ledger-'))
    const filePath = join(tempDir, 'consumed.jsonl')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const firstStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({
      filePath,
      now: () => '2026-03-12T19:56:00.000Z',
    })
    firstStore.load()

    const append = firstStore.markConsumedWithAuthority(digest, baseMetadata, validAuthority)
    expect(append).toEqual({ appended: true, reason: 'pass' })

    const [line] = readFileSync(filePath, 'utf8').trim().split('\n')
    const record = JSON.parse(line) as { writerId: string; writerToken: number; scopeKey: string }
    expect(record.writerId).toBe('runner-a')
    expect(record.writerToken).toBe(7)
    expect(record.scopeKey).toBe(baseScopeKey)

    const secondStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath })
    secondStore.load()

    const second = evaluateTacticOutputCapabilityRuntimeFreshnessTask1({
      claim: baseClaim,
      runtime: baseRuntime,
      consumedDigests: secondStore,
      consumeOnAllow: false,
    })

    expect(second.decision).toBe('duplicate')
  })
})
