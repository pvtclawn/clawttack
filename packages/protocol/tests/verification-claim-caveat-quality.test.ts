import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimCaveatQuality } from '../src/verification-claim-caveat-quality.ts'

describe('verification claim caveat quality', () => {
  it('fails caveat-token stuffing with insufficient semantic depth', () => {
    const result = evaluateVerificationClaimCaveatQuality({
      claimText: 'Simulation reliability improved.',
      caveatText: 'scope unresolved unverified.',
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('report-caveat-quality-insufficient')
    expect(result.missingSlots.length).toBeGreaterThan(0)
  })

  it('passes when all required caveat slots are present with scoped language', () => {
    const result = evaluateVerificationClaimCaveatQuality({
      claimText: 'Integration reliability improved for battle replay checks.',
      caveatText:
        'Scope: this update is limited to simulation verification artifacts and only covers fixture execution paths. A known open regression remains in cadence aggregation logic and is unresolved. Runtime behavior is not yet proven because live submit-path integration is not verified.',
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
    expect(result.slotChecks.scopeBound).toBe(true)
    expect(result.slotChecks.knownOpenRisk).toBe(true)
    expect(result.slotChecks.nonProvenStatement).toBe(true)
    expect(result.missingSlots).toEqual([])
  })

  it('fails when non-proven statement slot is missing', () => {
    const result = evaluateVerificationClaimCaveatQuality({
      claimText: 'Integration reliability improved for replay handling.',
      caveatText:
        'Scope: this update is limited to integration fixture checks and does not cover all runtime lanes. A known open risk remains because an unresolved nonce regression is still tracked as a blocker.',
    })

    expect(result.verdict).toBe('fail')
    expect(result.missingSlots).toContain('non-proven-statement')
  })

  it('is deterministic for identical input payloads', () => {
    const input = {
      claimText: 'Runtime reliability improved.',
      caveatText:
        'Scope: this claim is limited to current fixture evidence and does not cover unresolved integration edges. A known open issue remains in acceptance retries and is unresolved. Runtime confidence is not yet proven while live throughput stabilization is not verified.',
    }

    const a = evaluateVerificationClaimCaveatQuality(input)
    const b = evaluateVerificationClaimCaveatQuality(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
