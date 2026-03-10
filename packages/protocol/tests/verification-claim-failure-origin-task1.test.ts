import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimFailureOriginTask1 } from '../src/verification-claim-failure-origin-task1.ts'

describe('verification claim failure-origin task1', () => {
  it('fails when origin tag authenticity is invalid', () => {
    const result = evaluateVerificationClaimFailureOriginTask1({
      claimScope: 'component',
      evidence: [{ id: 'e1', origin: 'component', originTagAuthentic: false }],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('failure-origin-tag-invalid')
    expect(result.invalidOriginTagIds).toEqual(['e1'])
  })

  it('fails for mixed claim without dual-origin coverage', () => {
    const result = evaluateVerificationClaimFailureOriginTask1({
      claimScope: 'mixed',
      evidence: [{ id: 'e2', origin: 'component', originTagAuthentic: true }],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('failure-origin-mixed-coverage-insufficient')
  })

  it('passes when mixed claim has authentic dual-origin coverage', () => {
    const result = evaluateVerificationClaimFailureOriginTask1({
      claimScope: 'mixed',
      evidence: [
        { id: 'e3', origin: 'component', originTagAuthentic: true },
        { id: 'e4', origin: 'network', originTagAuthentic: true },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('failure-origin-pass')
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      claimScope: 'mixed' as const,
      evidence: [
        { id: 'e3', origin: 'component' as const, originTagAuthentic: true },
        { id: 'e4', origin: 'network' as const, originTagAuthentic: true },
      ],
    }

    const a = evaluateVerificationClaimFailureOriginTask1(input)
    const b = evaluateVerificationClaimFailureOriginTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
