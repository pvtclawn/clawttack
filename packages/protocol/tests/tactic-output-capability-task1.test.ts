import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticOutputCapabilityTask1,
  type TacticOutputCapabilityTask1Input,
} from '../src/tactic-output-capability-task1.ts'

describe('tactic output capability task1', () => {
  const baseInput: TacticOutputCapabilityTask1Input = {
    capability: 'operator-cap',
    requestedRole: 'operator-debug',
    blocked: false,
    contextDenied: false,
  }

  it('allows a valid role request', () => {
    const result = evaluateTacticOutputCapabilityTask1(baseInput)

    expect(result.mode).toBe('tactic-output-capability-allowed')
    expect(result.effectiveRole).toBe('operator-debug')
    expect(result.allowedRoles).toEqual(['public-reader', 'research-metrics', 'operator-debug'])
  })

  it('downgrades a richer-than-allowed request deterministically', () => {
    const result = evaluateTacticOutputCapabilityTask1({
      ...baseInput,
      capability: 'research-cap',
      requestedRole: 'operator-debug',
    })

    expect(result.mode).toBe('tactic-output-capability-downgraded')
    expect(result.effectiveRole).toBe('research-metrics')
    expect(result.triggers).toEqual([
      'effective:research-metrics',
      'policy:downgraded',
      'request:operator-debug',
    ])
  })

  it('denies unsupported requests in a blocked or denied context', () => {
    const result = evaluateTacticOutputCapabilityTask1({
      ...baseInput,
      requestedRole: 'internal-verifier',
      blocked: true,
      contextDenied: true,
    })

    expect(result.mode).toBe('tactic-output-capability-denied')
    expect(result.effectiveRole).toBeNull()
    expect(result.triggers).toEqual(['policy:blocked', 'policy:context-denied'])
  })

  it('resolves adjacent capability confusion via explicit lattice ordering', () => {
    const result = evaluateTacticOutputCapabilityTask1({
      ...baseInput,
      capability: 'research-cap',
      requestedRole: 'internal-verifier',
    })

    expect(result.mode).toBe('tactic-output-capability-downgraded')
    expect(result.effectiveRole).toBe('research-metrics')
  })

  it('is deterministic for identical inputs', () => {
    const a = evaluateTacticOutputCapabilityTask1(baseInput)
    const b = evaluateTacticOutputCapabilityTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
