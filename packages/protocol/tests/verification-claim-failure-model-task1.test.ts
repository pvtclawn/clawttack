import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimFailureModelTask1 } from '../src/verification-claim-failure-model-task1.ts'

describe('verification claim failure-model task1', () => {
  it('fails when effective model is downscoped from declared model', () => {
    const result = evaluateVerificationClaimFailureModelTask1({
      declaredModel: 'byzantine',
      effectiveModel: 'crash-stop',
      evidence: [{ id: 'e1', model: 'byzantine' }],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('failure-model-downscope-detected')
    expect(result.downscopeDetected).toBe(true)
  })

  it('fails when evidence model is weaker than declared model', () => {
    const result = evaluateVerificationClaimFailureModelTask1({
      declaredModel: 'crash-recovery',
      effectiveModel: 'crash-recovery',
      evidence: [
        { id: 'e2', model: 'crash-stop' },
        { id: 'e3', model: 'crash-recovery' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('failure-model-mismatch')
    expect(result.incompatibleEvidenceIds).toEqual(['e2'])
  })

  it('passes when model binding is preserved and evidence is compatible', () => {
    const result = evaluateVerificationClaimFailureModelTask1({
      declaredModel: 'omission',
      effectiveModel: 'omission',
      evidence: [
        { id: 'e4', model: 'omission' },
        { id: 'e5', model: 'crash-recovery' },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('failure-model-pass')
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      declaredModel: 'omission' as const,
      effectiveModel: 'omission' as const,
      evidence: [{ id: 'e6', model: 'byzantine' as const }],
    }

    const a = evaluateVerificationClaimFailureModelTask1(input)
    const b = evaluateVerificationClaimFailureModelTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
