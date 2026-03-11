import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticOutputPublicTask1,
  type TacticOutputPublicTask1Input,
} from '../src/tactic-output-public-task1.ts'

describe('tactic output public task1', () => {
  const baseInput: TacticOutputPublicTask1Input = {
    outputMode: 'tactic-output-primary',
    machineTrustFlag: 'trusted',
    verificationTier: 'primary',
    candidateSetSummary: ['prompt-injection', 'social-engineering'],
    caveat: 'Primary-path verification completed.',
    detailCost: 1,
    detailBudget: 2,
    hostileRisk: false,
  }

  it('yields public-safe for normal output within detail budget', () => {
    const result = evaluateTacticOutputPublicTask1(baseInput)

    expect(result.mode).toBe('tactic-output-public-safe')
    expect(result.artifact.publicMode).toBe('public-safe')
    expect(result.artifact.publicTier).toBe('normal')
    expect(result.artifact.detailDisposition).toBe('full')
  })

  it('yields redacted for degraded output with excessive detail budget usage', () => {
    const result = evaluateTacticOutputPublicTask1({
      ...baseInput,
      outputMode: 'tactic-output-degraded-fallback',
      machineTrustFlag: 'degraded-low-trust',
      verificationTier: 'degraded',
      caveat: 'Degraded fallback only: richer verification was not performed.',
      detailCost: 3,
      detailBudget: 1,
    })

    expect(result.mode).toBe('tactic-output-redacted')
    expect(result.artifact.publicMode).toBe('redacted')
    expect(result.artifact.trustLabel).toBe('low-trust')
    expect(result.artifact.publicTier).toBe('degraded')
    expect(result.artifact.detailDisposition).toBe('redacted')
    expect(result.artifact.publicCandidateSummary).toEqual(['prompt-injection'])
  })

  it('yields blocked for hostile blocked cases', () => {
    const result = evaluateTacticOutputPublicTask1({
      ...baseInput,
      outputMode: 'tactic-output-fail-closed',
      machineTrustFlag: 'blocked-untrusted',
      verificationTier: 'blocked',
      hostileRisk: true,
    })

    expect(result.mode).toBe('tactic-output-blocked')
    expect(result.artifact.publicMode).toBe('blocked')
    expect(result.artifact.trustLabel).toBe('blocked')
    expect(result.artifact.publicCandidateSummary).toEqual([])
  })

  it('uses a normalized public artifact shape across public-safe and redacted outputs', () => {
    const safe = evaluateTacticOutputPublicTask1(baseInput)
    const redacted = evaluateTacticOutputPublicTask1({
      ...baseInput,
      outputMode: 'tactic-output-degraded-fallback',
      machineTrustFlag: 'degraded-low-trust',
      verificationTier: 'degraded',
      detailCost: 3,
      detailBudget: 1,
    })

    expect(Object.keys(safe.artifact)).toEqual(Object.keys(redacted.artifact))
  })

  it('is deterministic for identical bundles', () => {
    const a = evaluateTacticOutputPublicTask1(baseInput)
    const b = evaluateTacticOutputPublicTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
