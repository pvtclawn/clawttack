import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimSafetyLivenessTask1 } from '../src/verification-claim-safety-liveness-task1.ts'

describe('verification claim safety+liveness task1', () => {
  it('fails when terminal appears without required prerequisite phases', () => {
    const result = evaluateVerificationClaimSafetyLivenessTask1({
      steps: [
        { stepIndex: 0, phase: 'ingest' },
        { stepIndex: 1, phase: 'terminal' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('terminal-prereq-missing')
    expect(result.missingPrereqPhases).toContain('caveat')
    expect(result.missingPrereqPhases).toContain('triangulation')
    expect(result.missingPrereqPhases).toContain('aggregate')
  })

  it('fails when trace continuity is broken by missing index link', () => {
    const result = evaluateVerificationClaimSafetyLivenessTask1({
      steps: [
        { stepIndex: 0, phase: 'ingest' },
        { stepIndex: 2, phase: 'caveat' },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('trace-continuity-missing')
    expect(result.continuityBroken).toBe(true)
  })

  it('passes when full prerequisite path and continuity are present', () => {
    const result = evaluateVerificationClaimSafetyLivenessTask1({
      steps: [
        { stepIndex: 0, phase: 'ingest' },
        { stepIndex: 1, phase: 'caveat' },
        { stepIndex: 2, phase: 'triangulation' },
        { stepIndex: 3, phase: 'aggregate' },
        { stepIndex: 4, phase: 'terminal' },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
    expect(result.continuityBroken).toBe(false)
    expect(result.missingPrereqPhases).toEqual([])
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      steps: [
        { stepIndex: 0, phase: 'ingest' as const },
        { stepIndex: 1, phase: 'caveat' as const },
        { stepIndex: 2, phase: 'triangulation' as const },
        { stepIndex: 3, phase: 'aggregate' as const },
        { stepIndex: 4, phase: 'terminal' as const },
      ],
    }

    const a = evaluateVerificationClaimSafetyLivenessTask1(input)
    const b = evaluateVerificationClaimSafetyLivenessTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
