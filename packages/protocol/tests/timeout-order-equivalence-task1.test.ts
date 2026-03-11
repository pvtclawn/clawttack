import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutOrderEquivalenceTask1,
  type TimeoutOrderEquivalenceTask1Input,
} from '../src/timeout-order-equivalence-task1.ts'

describe('timeout order equivalence task1', () => {
  const baseInput: TimeoutOrderEquivalenceTask1Input = {
    operationId: 'accept-battle#149',
    requiredConstraints: [
      {
        constraintId: 'c1',
        operationId: 'accept-battle#149',
        fromEventId: 'e1',
        toEventId: 'e2',
        kind: 'causal',
        provenanceValid: true,
      },
      {
        constraintId: 'c2',
        operationId: 'accept-battle#149',
        fromEventId: 'e2',
        toEventId: 'e3',
        kind: 'real-time',
        provenanceValid: true,
      },
    ],
    candidateConstraints: [
      {
        constraintId: 'c1',
        operationId: 'accept-battle#149',
        fromEventId: 'e1',
        toEventId: 'e2',
        kind: 'causal',
        provenanceValid: true,
      },
      {
        constraintId: 'c2',
        operationId: 'accept-battle#149',
        fromEventId: 'e2',
        toEventId: 'e3',
        kind: 'real-time',
        provenanceValid: true,
      },
    ],
  }

  it('fails when constraint provenance/authenticity is invalid', () => {
    const result = evaluateTimeoutOrderEquivalenceTask1({
      ...baseInput,
      candidateConstraints: [
        {
          ...baseInput.candidateConstraints[0],
          provenanceValid: false,
        },
        baseInput.candidateConstraints[1],
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-order-constraint-invalid')
    expect(result.invalidConstraintIds).toEqual(['c1'])
  })

  it('fails when required constraint coverage is incomplete', () => {
    const result = evaluateTimeoutOrderEquivalenceTask1({
      ...baseInput,
      candidateConstraints: [baseInput.candidateConstraints[0]],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-order-constraint-incomplete')
    expect(result.missingConstraintIds).toEqual(['c2'])
  })

  it('passes when constraints are authenticated and coverage-complete', () => {
    const result = evaluateTimeoutOrderEquivalenceTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-order-equivalent')
    expect(result.invalidConstraintIds).toEqual([])
    expect(result.missingConstraintIds).toEqual([])
    expect(result.duplicateConstraintIds).toEqual([])
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutOrderEquivalenceTask1(baseInput)
    const b = evaluateTimeoutOrderEquivalenceTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
