import { describe, expect, it } from 'bun:test'
import {
  computeEvidenceSchemaCompletenessHash,
  createInitialIterativeGoalState,
  evaluateIterativeGoalStep,
  getExpectedEvidenceCompletenessHash,
} from '../src/iterative-goal-verification'

describe('iterative goal-verification task-1', () => {
  it('accepts goalReached only with complete evidence schema hash', () => {
    const initial = createInitialIterativeGoalState()

    const { state, decision } = evaluateIterativeGoalStep(
      { maxIterations: 5 },
      initial,
      {
        verificationAction: 'verify-turn-chain',
        proposedGoalReached: true,
        evidence: {
          schemaVersion: 'v1',
          proofHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          completedChecks: ['counter-match', 'prev-hash-match'],
        },
      },
    )

    expect(decision.halted).toBe(true)
    expect(decision.haltReason).toBe('goal-reached')
    expect(state.halted).toBe(true)
    expect(state.haltReason).toBe('goal-reached')
    expect(decision.evidenceSchemaCompletenessHash).toBe(getExpectedEvidenceCompletenessHash())
  })

  it('fails deterministic with insufficient-verification-evidence on premature success spoof', () => {
    const initial = createInitialIterativeGoalState()

    const spoofStep = {
      verificationAction: 'verify-turn-chain',
      proposedGoalReached: true,
      evidence: {
        schemaVersion: 'v1',
        proofHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        completedChecks: [],
      },
    } as const

    const a = evaluateIterativeGoalStep({ maxIterations: 5 }, initial, spoofStep)
    const b = evaluateIterativeGoalStep({ maxIterations: 5 }, initial, spoofStep)

    expect(a.decision.haltReason).toBe('insufficient-verification-evidence')
    expect(a).toEqual(b)
  })

  it('halts with bounded fallback at max-iterations when goal unresolved', () => {
    let state = createInitialIterativeGoalState()

    const step1 = evaluateIterativeGoalStep(
      { maxIterations: 2 },
      state,
      {
        verificationAction: 'check-progress',
        proposedGoalReached: false,
        continueReason: 'need-more-evidence',
      },
    )
    state = step1.state
    expect(step1.decision.halted).toBe(false)

    const step2 = evaluateIterativeGoalStep(
      { maxIterations: 2 },
      state,
      {
        verificationAction: 'check-progress',
        proposedGoalReached: false,
        continueReason: 'still-pending',
      },
    )

    expect(step2.decision.halted).toBe(true)
    expect(step2.decision.haltReason).toBe('max-iterations')
  })

  it('completeness hash changes when required evidence fields are missing', () => {
    const completeHash = computeEvidenceSchemaCompletenessHash({
      schemaVersion: 'v1',
      proofHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      completedChecks: ['a'],
    })

    const incompleteHash = computeEvidenceSchemaCompletenessHash({
      schemaVersion: 'v1',
      proofHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      completedChecks: [],
    })

    expect(completeHash).toBe(getExpectedEvidenceCompletenessHash())
    expect(incompleteHash).not.toBe(getExpectedEvidenceCompletenessHash())
  })
})
