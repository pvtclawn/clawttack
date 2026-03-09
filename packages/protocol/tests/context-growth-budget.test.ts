import { describe, expect, it } from 'bun:test'
import {
  createInitialContextGrowthBudgetState,
  evaluateContextGrowthBudgetStep,
  type ContextGrowthBudgetConfig,
} from '../src/context-growth-budget'

const CONFIG: ContextGrowthBudgetConfig = {
  softThreshold: 0.8,
  hardThreshold: 0.95,
  windowSize: 3,
  nearThresholdMargin: 0.05,
  warningDebtPerNearThreshold: 1,
  warningDebtLimit: 3,
}

describe('context growth budget task-1', () => {
  it('does not escalate on stable low-utilization fixtures', () => {
    let state = createInitialContextGrowthBudgetState()

    for (let i = 0; i < 8; i += 1) {
      const step = evaluateContextGrowthBudgetStep(CONFIG, state, {
        promptDeltaEstimate: 50,
        toolTraceDeltaEstimate: 100,
        cumulativeContextRatio: 0.25,
      })

      expect(step.decision.reason).toBe('ok')
      expect(step.decision.halted).toBe(false)
      state = step.state
    }

    expect(state.warningDebt).toBe(0)
  })

  it('near-threshold oscillation cannot avoid warnings indefinitely', () => {
    let state = createInitialContextGrowthBudgetState()
    const reasons: string[] = []

    const oscillationRatios = [0.76, 0.77, 0.75, 0.77, 0.76, 0.75]

    for (const ratio of oscillationRatios) {
      const step = evaluateContextGrowthBudgetStep(CONFIG, state, {
        promptDeltaEstimate: 180,
        toolTraceDeltaEstimate: 200,
        cumulativeContextRatio: ratio,
      })
      reasons.push(step.decision.reason)
      state = step.state
    }

    expect(reasons).toContain('near-threshold-escalation')
  })

  it('hard threshold breaches halt deterministically', () => {
    const state = createInitialContextGrowthBudgetState()

    const step = evaluateContextGrowthBudgetStep(CONFIG, state, {
      promptDeltaEstimate: 500,
      toolTraceDeltaEstimate: 600,
      cumulativeContextRatio: 0.96,
    })

    expect(step.decision.halted).toBe(true)
    expect(step.decision.reason).toBe('context-budget-exceeded')
    expect(step.state.halted).toBe(true)
  })

  it('already-halted state remains deterministic on subsequent steps', () => {
    const initial = createInitialContextGrowthBudgetState()

    const halted = evaluateContextGrowthBudgetStep(CONFIG, initial, {
      promptDeltaEstimate: 1000,
      toolTraceDeltaEstimate: 1000,
      cumulativeContextRatio: 0.99,
    })

    const repeat = evaluateContextGrowthBudgetStep(CONFIG, halted.state, {
      promptDeltaEstimate: 10,
      toolTraceDeltaEstimate: 10,
      cumulativeContextRatio: 0.1,
    })

    expect(repeat.decision.reason).toBe('already-halted')
    expect(repeat.decision.halted).toBe(true)
  })
})
