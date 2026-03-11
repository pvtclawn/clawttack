import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutBucketCommutativityTask1,
  type TimeoutBucketCommutativityTask1Input,
} from '../src/timeout-bucket-commutativity-task1.ts'

describe('timeout bucket commutativity task1', () => {
  const baseInput: TimeoutBucketCommutativityTask1Input = {
    reducerVersion: 'v1.9.2',
    reducerDigest: '0xabc999',
    declaredCommutative: true,
    declaredIdempotent: true,
    authenticatedCapabilities: [
      {
        reducerVersion: 'v1.9.2',
        reducerDigest: '0xabc999',
        commutative: true,
        idempotent: true,
      },
    ],
  }

  it('fails when semantic flags are spoofed against authenticated capability', () => {
    const result = evaluateTimeoutBucketCommutativityTask1({
      ...baseInput,
      declaredCommutative: false,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-bucket-semantic-flag-invalid')
    expect(result.semanticFlagsMatch).toBe(false)
  })

  it('fails when reducer digest mismatches authenticated capability', () => {
    const result = evaluateTimeoutBucketCommutativityTask1({
      ...baseInput,
      reducerDigest: '0xdef222',
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-bucket-semantic-flag-invalid')
    expect(result.reducerDigestMatch).toBe(false)
  })

  it('passes when declared semantics match authenticated capability', () => {
    const result = evaluateTimeoutBucketCommutativityTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-bucket-commutative-pass')
    expect(result.capabilityFound).toBe(true)
    expect(result.reducerDigestMatch).toBe(true)
    expect(result.semanticFlagsMatch).toBe(true)
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutBucketCommutativityTask1(baseInput)
    const b = evaluateTimeoutBucketCommutativityTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
