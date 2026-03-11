import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticEscalationTask1,
  type TacticEscalationTask1Input,
} from '../src/tactic-escalation-task1.ts'

describe('tactic escalation task1', () => {
  const baseInput: TacticEscalationTask1Input = {
    screenReason: 'tactic-screen-pass',
    hypothesisReason: 'tactic-hypothesis-pass',
    contradictionScore: 0.12,
    explanationMargin: 0.62,
    alternativeDensity: 0.22,
    versionRisk: false,
    existingDebt: 0.1,
    debtStep: 0.15,
    acceptMinimumMargin: 0.25,
    acceptMaximumAlternativeDensity: 0.6,
    acceptMaximumDebt: 0.2,
    failClosedContradictionThreshold: 0.8,
    failClosedDebtThreshold: 0.85,
    diagnosticConfidence: 'high',
  }

  it('accepts the cheap path for a clean diagnostic bundle with low debt', () => {
    const result = evaluateTacticEscalationTask1(baseInput)

    expect(result.outcome).toBe('tactic-escalation-accept-cheap-path')
    expect(result.trace.updatedDebt).toBeCloseTo(0, 6)
    expect(result.trace.triggers).toEqual([])
  })

  it('increases debt deterministically for escalation-farming style inputs', () => {
    const result = evaluateTacticEscalationTask1({
      ...baseInput,
      screenReason: 'tactic-screen-pass',
      hypothesisReason: 'tactic-hypothesis-ambiguous',
      explanationMargin: 0.2,
      alternativeDensity: 0.58,
      existingDebt: 0.45,
      diagnosticConfidence: 'medium',
    })

    expect(result.outcome).toBe('tactic-escalation-request-deeper-verification')
    expect(result.trace.previousDebt).toBeCloseTo(0.45, 6)
    expect(result.trace.updatedDebt).toBeCloseTo(0.6, 6)
    expect(result.trace.triggers).toEqual([
      'confidence:medium',
      'debt:above-accept-threshold',
      'hypothesis:tactic-hypothesis-ambiguous',
      'margin:below-accept-threshold',
    ])
  })

  it('fails closed on stronger contradiction risk', () => {
    const result = evaluateTacticEscalationTask1({
      ...baseInput,
      contradictionScore: 0.9,
      hypothesisReason: 'tactic-hypothesis-contradicted',
      existingDebt: 0.2,
    })

    expect(result.outcome).toBe('tactic-escalation-fail-closed')
    expect(result.trace.triggers).toEqual([
      'contradiction:fail-closed-threshold',
      'hypothesis:tactic-hypothesis-contradicted',
    ])
  })

  it('is deterministic for identical bundles', () => {
    const a = evaluateTacticEscalationTask1(baseInput)
    const b = evaluateTacticEscalationTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
