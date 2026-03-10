import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimDeliverySemanticsTask1 } from '../src/verification-claim-delivery-semantics-task1.ts'

describe('verification claim delivery-semantics task1', () => {
  it('fails on duplicate replay storm over threshold', () => {
    const result = evaluateVerificationClaimDeliverySemanticsTask1({
      duplicateCountInWindow: 12,
      duplicateStormThreshold: 10,
      semanticReorderViolations: 0,
      semanticReorderThreshold: 2,
      events: [
        { envelopeId: 'e1', semanticStep: 1, receivedOrder: 1 },
        { envelopeId: 'e1', semanticStep: 1, receivedOrder: 2 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('delivery-duplicate-storm')
    expect(result.duplicateStormDetected).toBe(true)
  })

  it('fails on semantic reorder violation over threshold', () => {
    const result = evaluateVerificationClaimDeliverySemanticsTask1({
      duplicateCountInWindow: 1,
      duplicateStormThreshold: 10,
      semanticReorderViolations: 3,
      semanticReorderThreshold: 2,
      events: [
        { envelopeId: 'e2', semanticStep: 3, receivedOrder: 1 },
        { envelopeId: 'e3', semanticStep: 2, receivedOrder: 2 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('delivery-semantic-reorder-violation')
    expect(result.semanticReorderDetected).toBe(true)
  })

  it('passes when duplicate and reorder metrics are within bounds', () => {
    const result = evaluateVerificationClaimDeliverySemanticsTask1({
      duplicateCountInWindow: 2,
      duplicateStormThreshold: 10,
      semanticReorderViolations: 1,
      semanticReorderThreshold: 2,
      events: [
        { envelopeId: 'e4', semanticStep: 1, receivedOrder: 1 },
        { envelopeId: 'e5', semanticStep: 2, receivedOrder: 2 },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('delivery-semantics-pass')
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      duplicateCountInWindow: 2,
      duplicateStormThreshold: 10,
      semanticReorderViolations: 1,
      semanticReorderThreshold: 2,
      events: [
        { envelopeId: 'e4', semanticStep: 1, receivedOrder: 1 },
        { envelopeId: 'e5', semanticStep: 2, receivedOrder: 2 },
      ],
    }

    const a = evaluateVerificationClaimDeliverySemanticsTask1(input)
    const b = evaluateVerificationClaimDeliverySemanticsTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
