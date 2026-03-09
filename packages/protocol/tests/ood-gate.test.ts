import { describe, expect, it } from 'bun:test'
import { computeOodThresholdHash, evaluateOodGate, type OodGateInput } from '../src/ood-gate'

const BASE_INPUT: OodGateInput = {
  trainMetrics: {
    passRate: 0.96,
    rejectPrecision: 0.94,
    liveness: 0.97,
    composite: 0.95,
  },
  holdoutMetrics: {
    passRate: 0.92,
    rejectPrecision: 0.9,
    liveness: 0.93,
    composite: 0.9,
  },
  thresholds: {
    version: 'ood-v1',
    holdoutMinPassRate: 0.85,
    holdoutMinRejectPrecision: 0.85,
    holdoutMinLiveness: 0.85,
    maxGeneralizationGap: 0.1,
    minTrainComposite: 0.9,
  },
}

describe('ood gate task-2', () => {
  it('passes when floors and generalization gap are within bounds', () => {
    const result = evaluateOodGate(BASE_INPUT)
    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
    expect(result.thresholdVersion).toBe('ood-v1')
    expect(result.floorChecks).toEqual({
      holdoutPassRate: true,
      holdoutRejectPrecision: true,
      holdoutLiveness: true,
    })
  })

  it('fails with threshold-version-mismatch when version lock differs', () => {
    const result = evaluateOodGate({
      ...BASE_INPUT,
      expectedThresholdVersion: 'ood-v0',
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('threshold-version-mismatch')
  })

  it('fails with threshold-version-mismatch when threshold hash lock differs', () => {
    const wrongHash = computeOodThresholdHash({
      ...BASE_INPUT.thresholds,
      version: 'ood-v2',
    })

    const result = evaluateOodGate({
      ...BASE_INPUT,
      expectedThresholdHash: wrongHash,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('threshold-version-mismatch')
  })

  it('fails holdout floor checks deterministically', () => {
    const result = evaluateOodGate({
      ...BASE_INPUT,
      holdoutMetrics: {
        ...BASE_INPUT.holdoutMetrics,
        liveness: 0.6,
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('holdout-floor-fail')
    expect(result.floorChecks.holdoutLiveness).toBe(false)
  })

  it('fails when generalization gap is too large', () => {
    const result = evaluateOodGate({
      ...BASE_INPUT,
      holdoutMetrics: {
        ...BASE_INPUT.holdoutMetrics,
        composite: 0.7,
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('gap-too-large')
  })

  it('fails with train-regression against previous train composite', () => {
    const result = evaluateOodGate({
      ...BASE_INPUT,
      trainMetrics: {
        ...BASE_INPUT.trainMetrics,
        composite: 0.88,
      },
      previousTrainComposite: 0.93,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('train-regression')
  })

  it('returns deterministic verdict artifacts for identical inputs', () => {
    const a = evaluateOodGate(BASE_INPUT)
    const b = evaluateOodGate(BASE_INPUT)
    expect(a).toEqual(b)
  })
})
