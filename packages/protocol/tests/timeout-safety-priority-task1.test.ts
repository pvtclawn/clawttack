import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutSafetyPriorityTask1,
  type TimeoutSafetyPriorityTask1Input,
} from '../src/timeout-safety-priority-task1.ts'

describe('timeout safety-priority task1', () => {
  const baseInput: TimeoutSafetyPriorityTask1Input = {
    riskScore: 0.25,
    riskScoreProvenanceValid: true,
    confidenceScore: 0.75,
    confidenceInflationTolerance: 0.05,
    confidenceSources: [
      { sourceId: 'rpc-a', correlationGroup: 'cluster-a', contribution: 0.4 },
      { sourceId: 'rpc-b', correlationGroup: 'cluster-b', contribution: 0.35 },
    ],
  }

  it('fails when risk-score provenance is invalid', () => {
    const result = evaluateTimeoutSafetyPriorityTask1({
      ...baseInput,
      riskScoreProvenanceValid: false,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-safety-risk-score-invalid')
  })

  it('fails when confidence is inflated by correlated-source double counting', () => {
    const result = evaluateTimeoutSafetyPriorityTask1({
      ...baseInput,
      confidenceScore: 0.9,
      confidenceInflationTolerance: 0.01,
      confidenceSources: [
        { sourceId: 'rpc-a1', correlationGroup: 'cluster-a', contribution: 0.45 },
        { sourceId: 'rpc-a2', correlationGroup: 'cluster-a', contribution: 0.44 },
        { sourceId: 'rpc-b1', correlationGroup: 'cluster-b', contribution: 0.25 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-safety-confidence-inflated')
    expect(result.deduplicatedConfidenceScore).toBeCloseTo(0.7, 6)
  })

  it('passes for provenance-valid and de-duplicated confidence inputs', () => {
    const result = evaluateTimeoutSafetyPriorityTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-safety-priority-pass')
    expect(result.deduplicatedConfidenceScore).toBeCloseTo(0.75, 6)
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutSafetyPriorityTask1(baseInput)
    const b = evaluateTimeoutSafetyPriorityTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
