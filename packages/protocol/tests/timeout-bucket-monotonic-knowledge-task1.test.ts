import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutBucketMonotonicKnowledgeTask1,
  type TimeoutBucketMonotonicKnowledgeTask1Input,
} from '../src/timeout-bucket-monotonic-knowledge-task1.ts'

describe('timeout bucket monotonic knowledge task1', () => {
  const baseInput: TimeoutBucketMonotonicKnowledgeTask1Input = {
    reducerVersion: 'v2.0.1',
    reducerDigest: '0xaaa111',
    declaredMonotonicKnowledgeSafe: true,
    declaredSideEffectClasses: ['append-only-flag', 'counter-increment'],
    observedSideEffectClasses: ['append-only-flag', 'counter-increment'],
    transitiveEffects: [
      {
        effectId: 'e1',
        sideEffectClass: 'append-only-flag',
        regressesPredicates: false,
      },
      {
        effectId: 'e2',
        parentEffectId: 'e1',
        sideEffectClass: 'counter-increment',
        regressesPredicates: false,
      },
    ],
    authenticatedCapabilities: [
      {
        reducerVersion: 'v2.0.1',
        reducerDigest: '0xaaa111',
        monotonicKnowledgeSafe: true,
        allowedSideEffectClasses: ['append-only-flag', 'counter-increment'],
      },
    ],
  }

  it('fails semantic under-reporting / claim mismatch', () => {
    const result = evaluateTimeoutBucketMonotonicKnowledgeTask1({
      ...baseInput,
      declaredSideEffectClasses: ['append-only-flag'],
      observedSideEffectClasses: ['append-only-flag', 'counter-increment'],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-bucket-monotonicity-claim-invalid')
    expect(result.undeclaredObservedSideEffectClasses).toEqual(['counter-increment'])
  })

  it('fails hidden transitive regression side-effects', () => {
    const result = evaluateTimeoutBucketMonotonicKnowledgeTask1({
      ...baseInput,
      transitiveEffects: [
        ...baseInput.transitiveEffects,
        {
          effectId: 'e3',
          parentEffectId: 'e2',
          sideEffectClass: 'counter-increment',
          regressesPredicates: true,
        },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-bucket-transitive-regression-detected')
    expect(result.regressingEffectIds).toEqual(['e3'])
  })

  it('passes authenticated monotonic claim without regressions', () => {
    const result = evaluateTimeoutBucketMonotonicKnowledgeTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-bucket-monotonic-pass')
    expect(result.capabilityFound).toBe(true)
    expect(result.reducerDigestMatch).toBe(true)
    expect(result.monotonicClaimMatch).toBe(true)
    expect(result.undeclaredObservedSideEffectClasses).toEqual([])
    expect(result.disallowedSideEffectClasses).toEqual([])
    expect(result.regressingEffectIds).toEqual([])
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutBucketMonotonicKnowledgeTask1(baseInput)
    const b = evaluateTimeoutBucketMonotonicKnowledgeTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
