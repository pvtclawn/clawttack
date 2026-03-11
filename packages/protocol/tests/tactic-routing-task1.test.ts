import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticRoutingTask1,
  type TacticRoutingTask1Input,
} from '../src/tactic-routing-task1.ts'

describe('tactic routing task1', () => {
  const baseInput: TacticRoutingTask1Input = {
    escalationOutcome: 'tactic-escalation-accept-cheap-path',
    contradictionScore: 0.12,
    versionRisk: false,
    actorBudget: 1,
    contextBudget: 1,
    requiredBackupBudget: 0.3,
    existingDebt: 0.15,
    failClosedContradictionThreshold: 0.8,
  }

  it('routes a clean bundle with healthy budget to the primary path', () => {
    const result = evaluateTacticRoutingTask1(baseInput)

    expect(result.outcome).toBe('tactic-routing-primary-path')
    expect(result.trace.actorBudgetAfter).toBeCloseTo(1, 6)
    expect(result.trace.contextBudgetAfter).toBeCloseTo(1, 6)
    expect(result.trace.triggers).toEqual([])
  })

  it('routes a mixed but salvageable bundle with healthy budget to the backup path', () => {
    const result = evaluateTacticRoutingTask1({
      ...baseInput,
      escalationOutcome: 'tactic-escalation-request-deeper-verification',
      actorBudget: 0.75,
      contextBudget: 0.6,
      requiredBackupBudget: 0.25,
    })

    expect(result.outcome).toBe('tactic-routing-backup-path')
    expect(result.trace.actorBudgetBefore).toBeCloseTo(0.75, 6)
    expect(result.trace.actorBudgetAfter).toBeCloseTo(0.5, 6)
    expect(result.trace.contextBudgetAfter).toBeCloseTo(0.35, 6)
    expect(result.trace.triggers).toEqual(['escalation:request-deeper-verification'])
  })

  it('yields budget-exhausted for a salvageable case with exhausted backup budget', () => {
    const result = evaluateTacticRoutingTask1({
      ...baseInput,
      escalationOutcome: 'tactic-escalation-request-deeper-verification',
      actorBudget: 0.1,
      contextBudget: 0.5,
      requiredBackupBudget: 0.25,
    })

    expect(result.outcome).toBe('tactic-routing-budget-exhausted')
    expect(result.trace.actorBudgetAfter).toBeCloseTo(0.1, 6)
    expect(result.trace.triggers).toEqual([
      'budget:actor-insufficient',
      'escalation:request-deeper-verification',
    ])
  })

  it('fails closed for hostile contradiction risk', () => {
    const result = evaluateTacticRoutingTask1({
      ...baseInput,
      escalationOutcome: 'tactic-escalation-request-deeper-verification',
      contradictionScore: 0.92,
    })

    expect(result.outcome).toBe('tactic-routing-fail-closed')
    expect(result.trace.triggers).toEqual([
      'contradiction:fail-closed-threshold',
      'escalation:request-deeper-verification',
    ])
  })

  it('is deterministic for identical bundles', () => {
    const a = evaluateTacticRoutingTask1(baseInput)
    const b = evaluateTacticRoutingTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
