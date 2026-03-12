import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticOutputCapabilityContextTask1,
  type TacticOutputCapabilityContextTask1Input,
} from '../src/tactic-output-capability-context-task1.ts'

describe('tactic output capability context task1', () => {
  const baseInput: TacticOutputCapabilityContextTask1Input = {
    capability: 'operator-cap',
    requestedRole: 'operator-debug',
    blocked: false,
    contextDenied: false,
    boundScope: {
      scopeClass: 'battle',
      namespace: 'Arena-Alpha',
      scopeId: ' Battle-027 ',
      scopeVersion: 7,
    },
    presentedScope: {
      scopeClass: 'battle',
      namespace: ' arena-alpha ',
      scopeId: 'battle-027',
      scopeVersion: 7,
    },
    subsumptionRules: [],
  }

  it('allows matching role and canonically equivalent scope', () => {
    const result = evaluateTacticOutputCapabilityContextTask1(baseInput)

    expect(result.mode).toBe('tactic-output-capability-context-allowed')
    expect(result.capabilityMode).toBe('tactic-output-capability-allowed')
    expect(result.effectiveRole).toBe('operator-debug')
    expect(result.normalizedBoundScope).toEqual(result.normalizedPresentedScope)
  })

  it('fails adjacent-scope confusion without explicit subsumption rule', () => {
    const result = evaluateTacticOutputCapabilityContextTask1({
      ...baseInput,
      presentedScope: {
        ...baseInput.presentedScope,
        scopeClass: 'metrics',
      },
    })

    expect(result.mode).toBe('tactic-output-capability-context-denied')
    expect(result.triggers).toEqual([
      'bound:battle',
      'policy:context-mismatch',
      'presented:metrics',
    ])
  })

  it('downgrades deterministically when explicit subsumption rule is present', () => {
    const result = evaluateTacticOutputCapabilityContextTask1({
      ...baseInput,
      requestedRole: 'internal-verifier',
      presentedScope: {
        ...baseInput.presentedScope,
        scopeClass: 'metrics',
      },
      subsumptionRules: [{ fromScopeClass: 'metrics', toScopeClass: 'battle' }],
    })

    expect(result.mode).toBe('tactic-output-capability-context-downgraded')
    expect(result.capabilityMode).toBe('tactic-output-capability-downgraded')
    expect(result.effectiveRole).toBe('operator-debug')
    expect(result.triggers).toEqual([
      'bound:battle',
      'policy:context-subsumption',
      'presented:metrics',
    ])
  })

  it('is deterministic for identical inputs', () => {
    const a = evaluateTacticOutputCapabilityContextTask1(baseInput)
    const b = evaluateTacticOutputCapabilityContextTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
