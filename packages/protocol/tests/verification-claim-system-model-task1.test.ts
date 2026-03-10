import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimSystemModelTask1 } from '../src/verification-claim-system-model-task1.ts'

describe('verification claim system-model task1', () => {
  const completeAssumptions = {
    timingBounded: true,
    failureSemanticsDeclared: true,
    messageGuaranteesDeclared: true,
  } as const

  it('fails when profile authenticity is invalid', () => {
    const result = evaluateVerificationClaimSystemModelTask1({
      claimProfile: {
        profileId: 'claim-sync',
        profileAuthentic: false,
        assumptions: completeAssumptions,
      },
      evidenceProfiles: [],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('system-model-profile-invalid')
    expect(result.invalidProfileIds).toContain('claim-sync')
  })

  it('fails when assumptions are incomplete', () => {
    const result = evaluateVerificationClaimSystemModelTask1({
      claimProfile: {
        profileId: 'claim-partial',
        profileAuthentic: true,
        assumptions: {
          timingBounded: true,
          failureSemanticsDeclared: false,
          messageGuaranteesDeclared: true,
        },
      },
      evidenceProfiles: [],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('system-model-assumptions-incomplete')
    expect(result.incompleteAssumptionProfileIds).toContain('claim-partial')
  })

  it('passes when profile authenticity and assumptions are complete', () => {
    const result = evaluateVerificationClaimSystemModelTask1({
      claimProfile: {
        profileId: 'claim-sync',
        profileAuthentic: true,
        assumptions: completeAssumptions,
      },
      evidenceProfiles: [
        {
          profileId: 'evidence-sync',
          profileAuthentic: true,
          assumptions: completeAssumptions,
        },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('system-model-pass')
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      claimProfile: {
        profileId: 'claim-sync',
        profileAuthentic: true,
        assumptions: completeAssumptions,
      },
      evidenceProfiles: [
        {
          profileId: 'evidence-sync',
          profileAuthentic: true,
          assumptions: completeAssumptions,
        },
      ],
    }

    const a = evaluateVerificationClaimSystemModelTask1(input)
    const b = evaluateVerificationClaimSystemModelTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
