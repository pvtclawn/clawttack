import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutLogicalOrderNormalizationTask1,
  type TimeoutLogicalOrderNormalizationTask1Input,
} from '../src/timeout-logical-order-normalization-task1.ts'

describe('timeout logical-order normalization task1', () => {
  const baseInput: TimeoutLogicalOrderNormalizationTask1Input = {
    operationId: 'accept-battle#146',
    maxNonCriticalInCriticalBucket: 1,
    events: [
      { eventId: 'e1', bucketId: 'b1', critical: true, tieBreakKey: 'e1' },
      { eventId: 'e2', bucketId: 'b1', critical: false, tieBreakKey: 'e2' },
      { eventId: 'e3', bucketId: 'b2', critical: false, tieBreakKey: 'e3' },
    ],
  }

  it('fails when concurrent bucket is poisoned beyond allowed non-critical threshold', () => {
    const result = evaluateTimeoutLogicalOrderNormalizationTask1({
      ...baseInput,
      events: [
        { eventId: 'e1', bucketId: 'b1', critical: true, tieBreakKey: 'e1' },
        { eventId: 'e2', bucketId: 'b1', critical: false, tieBreakKey: 'e2' },
        { eventId: 'e4', bucketId: 'b1', critical: false, tieBreakKey: 'e4' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-logical-bucket-poisoned')
    expect(result.poisonedBucketIds).toEqual(['b1'])
  })

  it('fails when tie-break key is non-canonical/manipulated', () => {
    const result = evaluateTimeoutLogicalOrderNormalizationTask1({
      ...baseInput,
      events: [{ eventId: 'e1', bucketId: 'b1', critical: true, tieBreakKey: 'zzz' }],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-logical-tiebreak-invalid')
    expect(result.invalidTieBreakEventIds).toEqual(['e1'])
  })

  it('passes for canonical tie-breaks and unpoisoned bucket composition', () => {
    const result = evaluateTimeoutLogicalOrderNormalizationTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-logical-order-normalized')
    expect(result.poisonedBucketIds).toEqual([])
    expect(result.invalidTieBreakEventIds).toEqual([])
    expect(result.normalizedBuckets).toEqual({ b1: ['e1', 'e2'], b2: ['e3'] })
  })

  it('is deterministic for identical input tuples', () => {
    const a = evaluateTimeoutLogicalOrderNormalizationTask1(baseInput)
    const b = evaluateTimeoutLogicalOrderNormalizationTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
