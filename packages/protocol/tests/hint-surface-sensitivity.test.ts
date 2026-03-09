import { describe, expect, it } from 'bun:test'
import {
  evaluateHintSurfaceSensitivity,
  type HintSurfaceSensitivityInput,
  type HintSurfaceSensitivityThresholds,
} from '../src/hint-surface-sensitivity'

const THRESHOLDS: HintSurfaceSensitivityThresholds = {
  maxDegradation: {
    rejectPrecision: 0.1,
    liveness: 0.1,
    falsePositiveTerminalRejectRate: 0.08,
  },
  floors: {
    tier0: {
      minRejectPrecision: 0.85,
      minLiveness: 0.85,
      maxFalsePositiveTerminalRejectRate: 0.12,
    },
    tier1: {
      minRejectPrecision: 0.8,
      minLiveness: 0.8,
      maxFalsePositiveTerminalRejectRate: 0.15,
    },
    tier2: {
      minRejectPrecision: 0.75,
      minLiveness: 0.75,
      maxFalsePositiveTerminalRejectRate: 0.18,
    },
  },
  tier0NonRegression: {
    maxRejectPrecisionDrop: 0.03,
    maxLivenessDrop: 0.03,
    maxFalsePositiveIncrease: 0.03,
  },
}

const BASE_INPUT: HintSurfaceSensitivityInput = {
  tier0: {
    rejectPrecision: 0.9,
    liveness: 0.92,
    falsePositiveTerminalRejectRate: 0.08,
    unsafeBranchTaken: false,
  },
  tier1: {
    rejectPrecision: 0.87,
    liveness: 0.9,
    falsePositiveTerminalRejectRate: 0.09,
    unsafeBranchTaken: false,
  },
  tier2: {
    rejectPrecision: 0.83,
    liveness: 0.86,
    falsePositiveTerminalRejectRate: 0.12,
    unsafeBranchTaken: false,
  },
  previousTier0: {
    rejectPrecision: 0.91,
    liveness: 0.93,
    falsePositiveTerminalRejectRate: 0.07,
    unsafeBranchTaken: false,
  },
}

describe('hint-surface sensitivity gate task-2', () => {
  it('passes when slope + floors + tier0 non-regression all hold', () => {
    const result = evaluateHintSurfaceSensitivity(BASE_INPUT, THRESHOLDS)
    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
  })

  it('fails with tier-data-incomplete when any tier is missing', () => {
    const result = evaluateHintSurfaceSensitivity(
      {
        ...BASE_INPUT,
        tier2: undefined,
      },
      THRESHOLDS,
    )

    expect(result).toEqual({
      verdict: 'fail',
      reason: 'tier-data-incomplete',
    })
  })

  it('fails with unsafe-branch-flip for safe->unsafe transition', () => {
    const result = evaluateHintSurfaceSensitivity(
      {
        ...BASE_INPUT,
        tier2: {
          ...BASE_INPUT.tier2!,
          unsafeBranchTaken: true,
        },
      },
      THRESHOLDS,
    )

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('unsafe-branch-flip')
  })

  it('fails with slope-too-steep when degradation exceeds bounds', () => {
    const result = evaluateHintSurfaceSensitivity(
      {
        ...BASE_INPUT,
        tier2: {
          ...BASE_INPUT.tier2!,
          rejectPrecision: 0.6,
        },
      },
      THRESHOLDS,
    )

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('slope-too-steep')
  })

  it('fails with slope-too-steep when absolute tier floors fail', () => {
    const result = evaluateHintSurfaceSensitivity(
      {
        ...BASE_INPUT,
        tier1: {
          ...BASE_INPUT.tier1!,
          liveness: 0.5,
        },
      },
      THRESHOLDS,
    )

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('slope-too-steep')
    expect(result.floorChecks?.tier1).toBe(false)
  })

  it('fails with slope-too-steep on tier0 non-regression breach', () => {
    const result = evaluateHintSurfaceSensitivity(
      {
        ...BASE_INPUT,
        tier0: {
          ...BASE_INPUT.tier0!,
          rejectPrecision: 0.8,
        },
      },
      THRESHOLDS,
    )

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('slope-too-steep')
    expect((result.tier0Regression?.rejectPrecisionDrop ?? 0) > 0.03).toBe(true)
  })

  it('returns deterministic verdict artifact for identical inputs', () => {
    const a = evaluateHintSurfaceSensitivity(BASE_INPUT, THRESHOLDS)
    const b = evaluateHintSurfaceSensitivity(BASE_INPUT, THRESHOLDS)
    expect(a).toEqual(b)
  })
})
