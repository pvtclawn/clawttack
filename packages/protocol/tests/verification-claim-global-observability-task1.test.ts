import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimGlobalObservabilityTask1 } from '../src/verification-claim-global-observability-task1.ts'

describe('verification claim global-observability task1', () => {
  const baseInput = {
    requiredWitnesses: 3,
    minOperatorClasses: 2,
    minRegionClasses: 2,
  }

  it('fails when witness authenticity is invalid', () => {
    const result = evaluateVerificationClaimGlobalObservabilityTask1({
      ...baseInput,
      witnesses: [
        { witnessId: 'w1', isAuthentic: true, operatorClass: 'opA', regionClass: 'eu' },
        { witnessId: 'w2', isAuthentic: false, operatorClass: 'opB', regionClass: 'us' },
        { witnessId: 'w3', isAuthentic: true, operatorClass: 'opC', regionClass: 'apac' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('global-witness-auth-invalid')
    expect(result.invalidWitnessIds).toEqual(['w2'])
  })

  it('fails when witness diversity/coverage is insufficient', () => {
    const result = evaluateVerificationClaimGlobalObservabilityTask1({
      ...baseInput,
      witnesses: [
        { witnessId: 'w1', isAuthentic: true, operatorClass: 'opA', regionClass: 'eu' },
        { witnessId: 'w2', isAuthentic: true, operatorClass: 'opA', regionClass: 'eu' },
        { witnessId: 'w3', isAuthentic: true, operatorClass: 'opA', regionClass: 'eu' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('global-witness-diversity-insufficient')
  })

  it('passes with authentic and sufficiently diverse witnesses', () => {
    const result = evaluateVerificationClaimGlobalObservabilityTask1({
      ...baseInput,
      witnesses: [
        { witnessId: 'w1', isAuthentic: true, operatorClass: 'opA', regionClass: 'eu' },
        { witnessId: 'w2', isAuthentic: true, operatorClass: 'opB', regionClass: 'us' },
        { witnessId: 'w3', isAuthentic: true, operatorClass: 'opC', regionClass: 'apac' },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('global-observability-pass')
  })

  it('is deterministic for identical input', () => {
    const input = {
      ...baseInput,
      witnesses: [
        { witnessId: 'w1', isAuthentic: true, operatorClass: 'opA', regionClass: 'eu' },
        { witnessId: 'w2', isAuthentic: true, operatorClass: 'opB', regionClass: 'us' },
        { witnessId: 'w3', isAuthentic: true, operatorClass: 'opC', regionClass: 'apac' },
      ],
    }

    const a = evaluateVerificationClaimGlobalObservabilityTask1(input)
    const b = evaluateVerificationClaimGlobalObservabilityTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
