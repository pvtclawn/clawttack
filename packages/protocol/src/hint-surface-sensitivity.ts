const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export interface HintSurfaceTierMetrics {
  rejectPrecision: number
  liveness: number
  falsePositiveTerminalRejectRate: number
  unsafeBranchTaken: boolean
}

export interface HintSurfaceSensitivityInput {
  tier0?: HintSurfaceTierMetrics
  tier1?: HintSurfaceTierMetrics
  tier2?: HintSurfaceTierMetrics
  /** Optional prior baseline for tier-0 non-regression checks. */
  previousTier0?: HintSurfaceTierMetrics
}

export interface HintSurfaceSensitivityThresholds {
  maxDegradation: {
    rejectPrecision: number
    liveness: number
    falsePositiveTerminalRejectRate: number
  }
  floors: {
    tier0: {
      minRejectPrecision: number
      minLiveness: number
      maxFalsePositiveTerminalRejectRate: number
    }
    tier1: {
      minRejectPrecision: number
      minLiveness: number
      maxFalsePositiveTerminalRejectRate: number
    }
    tier2: {
      minRejectPrecision: number
      minLiveness: number
      maxFalsePositiveTerminalRejectRate: number
    }
  }
  tier0NonRegression: {
    maxRejectPrecisionDrop: number
    maxLivenessDrop: number
    maxFalsePositiveIncrease: number
  }
}

export type HintSurfaceVerdictReason =
  | 'pass'
  | 'slope-too-steep'
  | 'unsafe-branch-flip'
  | 'tier-data-incomplete'

export interface HintSurfaceSensitivityResult {
  verdict: 'pass' | 'fail'
  reason: HintSurfaceVerdictReason
  floorChecks?: {
    tier0: boolean
    tier1: boolean
    tier2: boolean
  }
  slopes?: {
    rejectPrecisionDrop: number
    livenessDrop: number
    falsePositiveIncrease: number
  }
  tier0Regression?: {
    rejectPrecisionDrop: number
    livenessDrop: number
    falsePositiveIncrease: number
  }
}

const tierPassesFloor = (
  tier: HintSurfaceTierMetrics,
  floor: {
    minRejectPrecision: number
    minLiveness: number
    maxFalsePositiveTerminalRejectRate: number
  },
): boolean => {
  return (
    clamp01(tier.rejectPrecision) >= clamp01(floor.minRejectPrecision) &&
    clamp01(tier.liveness) >= clamp01(floor.minLiveness) &&
    clamp01(tier.falsePositiveTerminalRejectRate) <=
      clamp01(floor.maxFalsePositiveTerminalRejectRate)
  )
}

/**
 * Simulation-only gate for hint-surface sensitivity.
 *
 * Task-2 guarantees:
 * - slope checks are combined with absolute tier floors,
 * - tier-0 non-regression is enforced when previous baseline is provided,
 * - deterministic verdict reasons for incomplete data / unsafe branch flips / steep degradation.
 */
export const evaluateHintSurfaceSensitivity = (
  input: HintSurfaceSensitivityInput,
  thresholds: HintSurfaceSensitivityThresholds,
): HintSurfaceSensitivityResult => {
  if (!input.tier0 || !input.tier1 || !input.tier2) {
    return {
      verdict: 'fail',
      reason: 'tier-data-incomplete',
    }
  }

  if (!input.tier0.unsafeBranchTaken && input.tier2.unsafeBranchTaken) {
    return {
      verdict: 'fail',
      reason: 'unsafe-branch-flip',
    }
  }

  const slopes = {
    rejectPrecisionDrop: Math.max(
      0,
      clamp01(input.tier0.rejectPrecision) - clamp01(input.tier2.rejectPrecision),
    ),
    livenessDrop: Math.max(0, clamp01(input.tier0.liveness) - clamp01(input.tier2.liveness)),
    falsePositiveIncrease: Math.max(
      0,
      clamp01(input.tier2.falsePositiveTerminalRejectRate) -
        clamp01(input.tier0.falsePositiveTerminalRejectRate),
    ),
  }

  const floorChecks = {
    tier0: tierPassesFloor(input.tier0, thresholds.floors.tier0),
    tier1: tierPassesFloor(input.tier1, thresholds.floors.tier1),
    tier2: tierPassesFloor(input.tier2, thresholds.floors.tier2),
  }

  const tier0Regression = input.previousTier0
    ? {
        rejectPrecisionDrop: Math.max(
          0,
          clamp01(input.previousTier0.rejectPrecision) -
            clamp01(input.tier0.rejectPrecision),
        ),
        livenessDrop: Math.max(
          0,
          clamp01(input.previousTier0.liveness) - clamp01(input.tier0.liveness),
        ),
        falsePositiveIncrease: Math.max(
          0,
          clamp01(input.tier0.falsePositiveTerminalRejectRate) -
            clamp01(input.previousTier0.falsePositiveTerminalRejectRate),
        ),
      }
    : {
        rejectPrecisionDrop: 0,
        livenessDrop: 0,
        falsePositiveIncrease: 0,
      }

  const slopeTooSteep =
    slopes.rejectPrecisionDrop > thresholds.maxDegradation.rejectPrecision ||
    slopes.livenessDrop > thresholds.maxDegradation.liveness ||
    slopes.falsePositiveIncrease >
      thresholds.maxDegradation.falsePositiveTerminalRejectRate

  const floorFailed = !floorChecks.tier0 || !floorChecks.tier1 || !floorChecks.tier2

  const tier0Regressed =
    tier0Regression.rejectPrecisionDrop >
      thresholds.tier0NonRegression.maxRejectPrecisionDrop ||
    tier0Regression.livenessDrop > thresholds.tier0NonRegression.maxLivenessDrop ||
    tier0Regression.falsePositiveIncrease >
      thresholds.tier0NonRegression.maxFalsePositiveIncrease

  if (slopeTooSteep || floorFailed || tier0Regressed) {
    return {
      verdict: 'fail',
      reason: 'slope-too-steep',
      slopes,
      floorChecks,
      tier0Regression,
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    slopes,
    floorChecks,
    tier0Regression,
  }
}
