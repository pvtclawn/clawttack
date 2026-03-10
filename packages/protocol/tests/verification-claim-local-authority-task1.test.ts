import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimLocalAuthorityTask1 } from '../src/verification-claim-local-authority-task1.ts'

describe('verification claim local-authority task1', () => {
  const base = {
    requiredUniqueAuthorities: 3,
    minQualityScore: 2.0,
  }

  it('fails on invalid authority identity', () => {
    const result = evaluateVerificationClaimLocalAuthorityTask1({
      ...base,
      records: [
        { authorityId: 'a1', authorityClass: 'static', isAuthentic: true, qualityScore: 0.8 },
        { authorityId: 'a2', authorityClass: 'dynamic', isAuthentic: false, qualityScore: 0.8 },
        { authorityId: 'a3', authorityClass: 'runtime', isAuthentic: true, qualityScore: 0.8 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('authority-identity-invalid')
    expect(result.invalidAuthorityIds).toEqual(['a2'])
  })

  it('fails on quorum padding / insufficient quality', () => {
    const result = evaluateVerificationClaimLocalAuthorityTask1({
      ...base,
      records: [
        { authorityId: 'a1', authorityClass: 'static', isAuthentic: true, qualityScore: 0.6 },
        { authorityId: 'a1', authorityClass: 'static', isAuthentic: true, qualityScore: 0.6 },
        { authorityId: 'a2', authorityClass: 'dynamic', isAuthentic: true, qualityScore: 0.3 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('authority-quorum-quality-insufficient')
    expect(result.duplicateAuthorityIds).toContain('a1')
  })

  it('passes on authentic unique authorities with sufficient quality', () => {
    const result = evaluateVerificationClaimLocalAuthorityTask1({
      ...base,
      records: [
        { authorityId: 'a1', authorityClass: 'static', isAuthentic: true, qualityScore: 0.8 },
        { authorityId: 'a2', authorityClass: 'dynamic', isAuthentic: true, qualityScore: 0.7 },
        { authorityId: 'a3', authorityClass: 'runtime', isAuthentic: true, qualityScore: 0.7 },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('local-authority-pass')
    expect(result.uniqueAuthorities).toBe(3)
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      ...base,
      records: [
        { authorityId: 'a1', authorityClass: 'static', isAuthentic: true, qualityScore: 0.8 },
        { authorityId: 'a2', authorityClass: 'dynamic', isAuthentic: true, qualityScore: 0.7 },
        { authorityId: 'a3', authorityClass: 'runtime', isAuthentic: true, qualityScore: 0.7 },
      ],
    }

    const a = evaluateVerificationClaimLocalAuthorityTask1(input)
    const b = evaluateVerificationClaimLocalAuthorityTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
