import { describe, expect, it } from 'bun:test'

import {
  computeTacticOutputCapabilityRuntimeClaimDigestTask1,
  evaluateTacticOutputCapabilityRuntimeFreshnessTask1,
  InMemoryTacticOutputCapabilityRuntimeFreshnessConsumedDigestStore,
  type TacticOutputCapabilityRuntimeFreshnessClaim,
  type TacticOutputCapabilityRuntimeFreshnessState,
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
})
