import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildTacticOutputCapabilityRuntimeFreshnessScopeKey,
  computeTacticOutputCapabilityRuntimeClaimDigestTask1,
  evaluateTacticOutputCapabilityRuntimeFreshnessTask1,
  FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore,
  FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore,
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

  const authoritySource = 'witness-cache-a'

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

  const advancedAuthority: TacticOutputCapabilityRuntimeFreshnessWriterAuthority = {
    scopeKey: baseScopeKey,
    writerId: 'runner-a',
    heldToken: 12,
    lockState: {
      scopeKey: baseScopeKey,
      ownerId: 'runner-a',
      activeToken: 12,
      tokenFloor: 12,
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

  it('denies authoritative append while a scope is sealed', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const ledgerFilePath = join(tempDir, 'consumed.jsonl')
    const sealFilePath = join(tempDir, 'sealed.json')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const ledgerStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath: ledgerFilePath })
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    ledgerStore.load()
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'witness lost',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'missing',
      uncertaintyEpoch: 1,
    })

    const result = ledgerStore.markConsumedWithAuthorityWhileUnsealed(
      digest,
      baseMetadata,
      validAuthority,
      sealStore,
      sealStore.getUncertaintyEpoch(baseScopeKey),
    )

    expect(result).toEqual({ appended: false, reason: 'sealed-scope' })
    expect(ledgerStore.has(digest)).toBe(false)
  })

  it('preserves sealed state across restart and keeps append denied', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const ledgerFilePath = join(tempDir, 'consumed.jsonl')
    const sealFilePath = join(tempDir, 'sealed.json')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const firstSealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({
      filePath: sealFilePath,
      now: () => '2026-03-12T20:22:00.000Z',
    })
    firstSealStore.load()
    firstSealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'partition detected',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'timeout-suspected',
      uncertaintyEpoch: 2,
    })

    const secondSealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    secondSealStore.load()

    const ledgerStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath: ledgerFilePath })
    ledgerStore.load()

    const result = ledgerStore.markConsumedWithAuthorityWhileUnsealed(
      digest,
      baseMetadata,
      validAuthority,
      secondSealStore,
      secondSealStore.getUncertaintyEpoch(baseScopeKey),
    )

    expect(secondSealStore.isSealed(baseScopeKey)).toBe(true)
    expect(result).toEqual({ appended: false, reason: 'sealed-scope' })
    expect(ledgerStore.has(digest)).toBe(false)
  })

  it('denies unseal for a stale witness', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const sealFilePath = join(tempDir, 'sealed.json')
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'witness lost',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'stale',
      uncertaintyEpoch: 7,
    })

    const result = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: {
        scopeKey: baseScopeKey,
        authorityEpoch: 7,
        authoritySource,
      },
    })

    expect(result).toEqual({ unsealed: false, reason: 'stale-authority-witness' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(true)
  })

  it('allows fresh matching witness to unseal and restore authoritative append', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const ledgerFilePath = join(tempDir, 'consumed.jsonl')
    const sealFilePath = join(tempDir, 'sealed.json')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const ledgerStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath: ledgerFilePath })
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    ledgerStore.load()
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'witness lost',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'missing',
      uncertaintyEpoch: 1,
    })

    const unseal = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: {
        scopeKey: baseScopeKey,
        authorityEpoch: 12,
        authoritySource,
      },
    })

    const append = ledgerStore.markConsumedWithAuthorityWhileUnsealed(
      digest,
      baseMetadata,
      advancedAuthority,
      sealStore,
      sealStore.getUncertaintyEpoch(baseScopeKey),
    )

    expect(unseal).toEqual({ unsealed: true, reason: 'pass' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(false)
    expect(append).toEqual({ appended: true, reason: 'pass' })
  })

  it('does not fail open when witness is missing', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const ledgerFilePath = join(tempDir, 'consumed.jsonl')
    const sealFilePath = join(tempDir, 'sealed.json')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const ledgerStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath: ledgerFilePath })
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    ledgerStore.load()
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'witness unavailable',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'missing',
      uncertaintyEpoch: 3,
    })

    const unseal = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: undefined,
    })
    const append = ledgerStore.markConsumedWithAuthorityWhileUnsealed(
      digest,
      baseMetadata,
      validAuthority,
      sealStore,
      sealStore.getUncertaintyEpoch(baseScopeKey),
    )

    expect(unseal).toEqual({ unsealed: false, reason: 'missing-authority-witness' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(true)
    expect(append).toEqual({ appended: false, reason: 'sealed-scope' })
    expect(ledgerStore.has(digest)).toBe(false)
  })

  it('preserves conflicting uncertainty across restart', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const sealFilePath = join(tempDir, 'sealed.json')

    const firstStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({
      filePath: sealFilePath,
      now: () => '2026-03-12T20:57:00.000Z',
    })
    firstStore.load()
    firstStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'conflicting authority evidence',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'conflicting',
      uncertaintyEpoch: 11,
    })

    const secondStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    secondStore.load()
    const state = secondStore.getScopeState(baseScopeKey)

    expect(state?.sealed).toBe(true)
    expect(state?.uncertaintyClass).toBe('conflicting')
    expect(state?.uncertaintyEpoch).toBe(11)
    expect(state?.committedAuthorityEpoch).toBe(7)
    expect(state?.authoritySource).toBe(authoritySource)
  })

  it('rejects a fake newer epoch without valid provenance', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const sealFilePath = join(tempDir, 'sealed.json')
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'witness timeout',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'timeout-suspected',
      uncertaintyEpoch: 9,
    })

    const result = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: {
        scopeKey: baseScopeKey,
        authorityEpoch: 12,
        authoritySource: 'forged-cache-b',
      },
    })

    expect(result).toEqual({ unsealed: false, reason: 'invalid-authority-provenance' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(true)
  })

  it('does not let a generic stale witness clear contradictory state', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const sealFilePath = join(tempDir, 'sealed.json')
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'conflicting authority evidence',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'conflicting',
      uncertaintyEpoch: 11,
    })

    const result = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: {
        scopeKey: baseScopeKey,
        authorityEpoch: 8,
        authoritySource,
      },
    })

    expect(result).toEqual({ unsealed: false, reason: 'stale-authority-witness' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(true)
  })

  it('preserves contradiction context even with a newer epoch until explicitly resolved', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const sealFilePath = join(tempDir, 'sealed.json')
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    sealStore.load()
    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'conflicting authority evidence',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'conflicting',
      uncertaintyEpoch: 11,
    })

    const unresolved = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: {
        scopeKey: baseScopeKey,
        authorityEpoch: 12,
        authoritySource,
      },
    })

    expect(unresolved).toEqual({ unsealed: false, reason: 'unresolved-contradiction' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(true)

    const resolved = sealStore.unsealScope({
      scopeKey: baseScopeKey,
      witness: {
        scopeKey: baseScopeKey,
        authorityEpoch: 12,
        authoritySource,
        resolvedUncertaintyClass: 'conflicting',
      },
    })

    expect(resolved).toEqual({ unsealed: true, reason: 'pass' })
    expect(sealStore.isSealed(baseScopeKey)).toBe(false)
  })

  it('invalidates stale admitted work after uncertainty epoch advances', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const ledgerFilePath = join(tempDir, 'consumed.jsonl')
    const sealFilePath = join(tempDir, 'sealed.json')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const ledgerStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath: ledgerFilePath })
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    ledgerStore.load()
    sealStore.load()

    const observedEpochAtAdmission = sealStore.getUncertaintyEpoch(baseScopeKey)
    expect(observedEpochAtAdmission).toBe(0)

    sealStore.sealScope({
      scopeKey: baseScopeKey,
      sealReason: 'witness timeout',
      authorityEpoch: 7,
      authoritySource,
      uncertaintyClass: 'timeout-suspected',
      uncertaintyEpoch: 1,
    })

    const result = ledgerStore.markConsumedWithAuthorityWhileUnsealed(
      digest,
      baseMetadata,
      validAuthority,
      sealStore,
      observedEpochAtAdmission,
    )

    expect(result).toEqual({ appended: false, reason: 'stale-uncertainty-epoch' })
    expect(ledgerStore.has(digest)).toBe(false)
  })

  it('fails closed when append lacks uncertainty epoch proof', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'freshness-sealed-'))
    const ledgerFilePath = join(tempDir, 'consumed.jsonl')
    const sealFilePath = join(tempDir, 'sealed.json')
    const digest = computeTacticOutputCapabilityRuntimeClaimDigestTask1(baseClaim)

    const ledgerStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore({ filePath: ledgerFilePath })
    const sealStore = new FileBackedTacticOutputCapabilityRuntimeFreshnessSealedScopeStore({ filePath: sealFilePath })
    ledgerStore.load()
    sealStore.load()

    const result = ledgerStore.markConsumedWithAuthorityWhileUnsealed(
      digest,
      baseMetadata,
      validAuthority,
      sealStore,
      undefined,
    )

    expect(result).toEqual({ appended: false, reason: 'missing-uncertainty-epoch' })
    expect(ledgerStore.has(digest)).toBe(false)
  })
})
