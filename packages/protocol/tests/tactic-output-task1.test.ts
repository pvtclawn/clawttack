import { describe, expect, it } from 'bun:test'

import { evaluateTacticOutputTask1, type TacticOutputTask1Input } from '../src/tactic-output-task1.ts'

describe('tactic output task1', () => {
  const baseInput: TacticOutputTask1Input = {
    routingOutcome: 'tactic-routing-primary-path',
    hostileRisk: false,
    lowTrustSummary: 'Backup verification budget exhausted; output is low-confidence only.',
    candidateSetSummary: ['prompt-injection', 'social-engineering'],
  }

  it('yields tactic-output-primary for a primary route', () => {
    const result = evaluateTacticOutputTask1(baseInput)

    expect(result.mode).toBe('tactic-output-primary')
    expect(result.artifact.trustLevel).toBe('high')
    expect(result.artifact.verificationTier).toBe('primary')
    expect(result.artifact.machineTrustFlag).toBe('trusted')
  })

  it('yields tactic-output-backup for a backup route', () => {
    const result = evaluateTacticOutputTask1({
      ...baseInput,
      routingOutcome: 'tactic-routing-backup-path',
    })

    expect(result.mode).toBe('tactic-output-backup')
    expect(result.artifact.trustLevel).toBe('medium')
    expect(result.artifact.verificationTier).toBe('backup')
  })

  it('yields low-trust degraded fallback for a non-hostile budget-exhausted case', () => {
    const result = evaluateTacticOutputTask1({
      ...baseInput,
      routingOutcome: 'tactic-routing-budget-exhausted',
    })

    expect(result.mode).toBe('tactic-output-degraded-fallback')
    expect(result.artifact.trustLevel).toBe('low')
    expect(result.artifact.verificationTier).toBe('degraded')
    expect(result.artifact.machineTrustFlag).toBe('degraded-low-trust')
    expect(result.artifact.caveat).toContain('Degraded fallback only')
  })

  it('yields fail-closed for hostile cases', () => {
    const result = evaluateTacticOutputTask1({
      ...baseInput,
      routingOutcome: 'tactic-routing-budget-exhausted',
      hostileRisk: true,
    })

    expect(result.mode).toBe('tactic-output-fail-closed')
    expect(result.artifact.trustLevel).toBe('none')
    expect(result.artifact.machineTrustFlag).toBe('blocked-untrusted')
    expect(result.artifact.candidateSetSummary).toEqual([])
  })

  it('is deterministic for identical bundles', () => {
    const a = evaluateTacticOutputTask1(baseInput)
    const b = evaluateTacticOutputTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
