import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimInteractionTask1 } from '../src/verification-claim-interaction-task1.ts'

describe('verification claim interaction task1', () => {
  it('fails when required module evidence is incomplete', () => {
    const result = evaluateVerificationClaimInteractionTask1({
      aggregateVerdict: 'pass',
      moduleVerdicts: [
        { module: 'caveat', verdict: 'pass' },
        { module: 'triangulation', verdict: 'pass' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('interaction-evidence-incomplete')
    expect(result.missingModules.length).toBeGreaterThan(0)
  })

  it('fails on prerequisite conflict when aggregate says pass', () => {
    const result = evaluateVerificationClaimInteractionTask1({
      aggregateVerdict: 'pass',
      moduleVerdicts: [
        { module: 'caveat', verdict: 'pass' },
        { module: 'triangulation', verdict: 'fail' },
        { module: 'trace', verdict: 'pass' },
        { module: 'safetyLiveness', verdict: 'pass' },
        { module: 'responsiveness', verdict: 'pass' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('interaction-prereq-conflict')
    expect(result.conflictingModules).toContain('triangulation')
  })

  it('passes when required modules are complete and conflict-free', () => {
    const result = evaluateVerificationClaimInteractionTask1({
      aggregateVerdict: 'pass',
      moduleVerdicts: [
        { module: 'caveat', verdict: 'pass' },
        { module: 'triangulation', verdict: 'pass' },
        { module: 'trace', verdict: 'pass' },
        { module: 'safetyLiveness', verdict: 'pass' },
        { module: 'responsiveness', verdict: 'pass' },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('interaction-consistency-pass')
    expect(result.missingModules).toEqual([])
    expect(result.conflictingModules).toEqual([])
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      aggregateVerdict: 'pass' as const,
      moduleVerdicts: [
        { module: 'caveat' as const, verdict: 'pass' as const },
        { module: 'triangulation' as const, verdict: 'pass' as const },
        { module: 'trace' as const, verdict: 'pass' as const },
        { module: 'safetyLiveness' as const, verdict: 'pass' as const },
        { module: 'responsiveness' as const, verdict: 'pass' as const },
      ],
    }

    const a = evaluateVerificationClaimInteractionTask1(input)
    const b = evaluateVerificationClaimInteractionTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
    expect(a.completenessHash).toBe(b.completenessHash)
  })
})
