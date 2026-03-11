import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutCausalOrderingTask1,
  type TimeoutCausalOrderingTask1Input,
} from '../src/timeout-causal-ordering-task1.ts'

describe('timeout causal ordering task1', () => {
  const baseInput: TimeoutCausalOrderingTask1Input = {
    operationId: 'accept-battle#144',
    requiredEventIds: ['e1', 'e2'],
    events: [
      {
        eventId: 'e1',
        operationId: 'accept-battle#144',
        dependsOn: [],
        edgeAuthValid: true,
      },
      {
        eventId: 'e2',
        operationId: 'accept-battle#144',
        dependsOn: ['e1'],
        edgeAuthValid: true,
      },
    ],
  }

  it('fails when dependency edge authenticity is invalid', () => {
    const result = evaluateTimeoutCausalOrderingTask1({
      ...baseInput,
      events: [
        { ...baseInput.events[0], edgeAuthValid: false },
        baseInput.events[1],
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-causal-edge-invalid')
    expect(result.invalidEdgeEventIds).toEqual(['e1'])
  })

  it('fails when required dependency context is incomplete', () => {
    const result = evaluateTimeoutCausalOrderingTask1({
      ...baseInput,
      events: [baseInput.events[0]],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-causal-context-incomplete')
    expect(result.missingRequiredEventIds).toEqual(['e2'])
  })

  it('passes for authenticated and complete dependency context', () => {
    const result = evaluateTimeoutCausalOrderingTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-causal-order-pass')
    expect(result.invalidEdgeEventIds).toEqual([])
    expect(result.missingRequiredEventIds).toEqual([])
    expect(result.missingDependencyEventIds).toEqual([])
    expect(result.duplicateEventIds).toEqual([])
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutCausalOrderingTask1(baseInput)
    const b = evaluateTimeoutCausalOrderingTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
