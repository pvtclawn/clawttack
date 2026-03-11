import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutReplayEquivalenceTask1,
  type TimeoutReplayEquivalenceTask1Input,
} from '../src/timeout-replay-equivalence-task1.ts'

describe('timeout replay-equivalence task1', () => {
  const baseInput: TimeoutReplayEquivalenceTask1Input = {
    expectedReducerDigest: '0xabc123',
    observedReducerDigest: '0xabc123',
    expectedContext: {
      chainId: 84532,
      arena: '0x2ab05eab902db3fda647b3ec798c2d28c7489b7e',
      operationId: 'accept-battle#152',
      reducerVersion: 'v1.4.0',
    },
    observedContext: {
      chainId: 84532,
      arena: '0x2ab05eab902db3fda647b3ec798c2d28c7489b7e',
      operationId: 'accept-battle#152',
      reducerVersion: 'v1.4.0',
    },
  }

  it('fails reducer-version mismatch', () => {
    const result = evaluateTimeoutReplayEquivalenceTask1({
      ...baseInput,
      observedReducerDigest: '0xdef999',
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-replay-reducer-version-invalid')
    expect(result.reducerDigestMatch).toBe(false)
  })

  it('fails context-tuple mismatch', () => {
    const result = evaluateTimeoutReplayEquivalenceTask1({
      ...baseInput,
      observedContext: {
        ...baseInput.observedContext,
        operationId: 'accept-battle#153',
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-replay-context-mismatch')
    expect(result.contextMatch).toBe(false)
  })

  it('passes for matching reducer digest and context tuple', () => {
    const result = evaluateTimeoutReplayEquivalenceTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-replay-equivalent')
    expect(result.reducerDigestMatch).toBe(true)
    expect(result.contextMatch).toBe(true)
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutReplayEquivalenceTask1(baseInput)
    const b = evaluateTimeoutReplayEquivalenceTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
