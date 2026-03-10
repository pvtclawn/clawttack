import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimMembershipEpochTask1 } from '../src/verification-claim-membership-epoch-task1.ts'

describe('verification claim membership-epoch task1', () => {
  const now = 1_762_700_000_000

  it('fails when evidence is stale', () => {
    const result = evaluateVerificationClaimMembershipEpochTask1({
      currentEpochId: 'epoch-10',
      currentTimeUnixMs: now,
      maxStalenessMs: 60_000,
      evidence: [{ id: 'e1', epochId: 'epoch-10', observedAtUnixMs: now - 120_000 }],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('membership-epoch-stale')
    expect(result.staleEvidenceIds).toEqual(['e1'])
  })

  it('fails when split-view epoch evidence is detected', () => {
    const result = evaluateVerificationClaimMembershipEpochTask1({
      currentEpochId: 'epoch-10',
      currentTimeUnixMs: now,
      maxStalenessMs: 60_000,
      evidence: [
        { id: 'e1', epochId: 'epoch-10', observedAtUnixMs: now - 10_000 },
        { id: 'e2', epochId: 'epoch-11', observedAtUnixMs: now - 10_000 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('membership-epoch-split-view')
    expect(result.splitViewDetected).toBe(true)
  })

  it('passes when evidence is fresh and same-epoch', () => {
    const result = evaluateVerificationClaimMembershipEpochTask1({
      currentEpochId: 'epoch-10',
      currentTimeUnixMs: now,
      maxStalenessMs: 60_000,
      evidence: [
        { id: 'e1', epochId: 'epoch-10', observedAtUnixMs: now - 5_000 },
        { id: 'e2', epochId: 'epoch-10', observedAtUnixMs: now - 8_000 },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('membership-epoch-pass')
  })

  it('is deterministic for identical inputs', () => {
    const input = {
      currentEpochId: 'epoch-10',
      currentTimeUnixMs: now,
      maxStalenessMs: 60_000,
      evidence: [
        { id: 'e1', epochId: 'epoch-10', observedAtUnixMs: now - 5_000 },
        { id: 'e2', epochId: 'epoch-10', observedAtUnixMs: now - 8_000 },
      ],
    }

    const a = evaluateVerificationClaimMembershipEpochTask1(input)
    const b = evaluateVerificationClaimMembershipEpochTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
