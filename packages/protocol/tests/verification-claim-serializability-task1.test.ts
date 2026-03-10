import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimSerializabilityTask1 } from '../src/verification-claim-serializability-task1.ts'

describe('verification claim serializability task1', () => {
  it('fails on dependency order violation', () => {
    const result = evaluateVerificationClaimSerializabilityTask1({
      commutativityWhitelist: ['read-only-op'],
      actions: [
        { id: 'a1', order: 2, dependencyOrderExpected: 1, operationType: 'state-write', commutativityProof: false },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('serializability-dependency-order-violation')
    expect(result.dependencyViolations).toEqual(['a1'])
  })

  it('fails when commutativity proof is used outside whitelist', () => {
    const result = evaluateVerificationClaimSerializabilityTask1({
      commutativityWhitelist: ['read-only-op'],
      actions: [
        { id: 'a2', order: 1, dependencyOrderExpected: 1, operationType: 'state-write', commutativityProof: true },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('serializability-commutativity-invalid')
    expect(result.invalidCommutativityProofs).toEqual(['a2'])
  })

  it('passes when dependency order and commutativity proofs are valid', () => {
    const result = evaluateVerificationClaimSerializabilityTask1({
      commutativityWhitelist: ['read-only-op'],
      actions: [
        { id: 'a3', order: 1, dependencyOrderExpected: 1, operationType: 'read-only-op', commutativityProof: true },
        { id: 'a4', order: 2, dependencyOrderExpected: 2, operationType: 'state-write', commutativityProof: false },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('serializability-pass')
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      commutativityWhitelist: ['read-only-op'],
      actions: [
        { id: 'a3', order: 1, dependencyOrderExpected: 1, operationType: 'read-only-op', commutativityProof: true },
        { id: 'a4', order: 2, dependencyOrderExpected: 2, operationType: 'state-write', commutativityProof: false },
      ],
    }

    const a = evaluateVerificationClaimSerializabilityTask1(input)
    const b = evaluateVerificationClaimSerializabilityTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
