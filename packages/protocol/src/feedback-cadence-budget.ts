const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export interface FeedbackCadenceWindow {
  windowId: string
  changesPerWindow: number
  verifyIntervalMinutes: number
  windowSizeMinutes: number
}

export interface FeedbackCadenceTask1Config {
  maxSingleWindowRisk: number
  maxRollingWindowRisk: number
  rollingWindowSpan: number
  maxBurstiness: number
  warningRatio?: number
}

export interface FixedWindowVerdict {
  windowId: string
  risk: number
  velocity: number
  overBudget: boolean
}

export interface RollingWindowVerdict {
  windowIds: string[]
  aggregateRisk: number
  averageVelocity: number
  burstiness: number
  overBudget: boolean
}

export type FeedbackCadenceReason =
  | 'cadence-ok'
  | 'cadence-warning'
  | 'cadence-budget-exceeded'

export interface FeedbackCadenceTask1Result {
  verdict: 'pass' | 'fail'
  reason: FeedbackCadenceReason
  fixedWindow: FixedWindowVerdict[]
  rollingWindow: RollingWindowVerdict[]
}

const validateConfig = (config: FeedbackCadenceTask1Config): void => {
  if (!Number.isFinite(config.maxSingleWindowRisk) || config.maxSingleWindowRisk <= 0) {
    throw new Error('invalid-max-single-window-risk')
  }
  if (!Number.isFinite(config.maxRollingWindowRisk) || config.maxRollingWindowRisk <= 0) {
    throw new Error('invalid-max-rolling-window-risk')
  }
  if (!Number.isInteger(config.rollingWindowSpan) || config.rollingWindowSpan < 2) {
    throw new Error('invalid-rolling-window-span')
  }
  if (!Number.isFinite(config.maxBurstiness) || config.maxBurstiness <= 0) {
    throw new Error('invalid-max-burstiness')
  }
  if (config.warningRatio != null && (!Number.isFinite(config.warningRatio) || config.warningRatio <= 0)) {
    throw new Error('invalid-warning-ratio')
  }
}

const validateWindow = (window: FeedbackCadenceWindow): void => {
  if (!window.windowId || window.windowId.trim().length === 0) {
    throw new Error('invalid-window-id')
  }
  if (!Number.isFinite(window.changesPerWindow) || window.changesPerWindow < 0) {
    throw new Error('invalid-changes-per-window')
  }
  if (!Number.isFinite(window.verifyIntervalMinutes) || window.verifyIntervalMinutes <= 0) {
    throw new Error('invalid-verify-interval')
  }
  if (!Number.isFinite(window.windowSizeMinutes) || window.windowSizeMinutes <= 0) {
    throw new Error('invalid-window-size')
  }
}

const velocity = (window: FeedbackCadenceWindow): number =>
  window.changesPerWindow / window.windowSizeMinutes

const singleWindowRisk = (window: FeedbackCadenceWindow): number =>
  velocity(window) * window.verifyIntervalMinutes

/**
 * Task-1 cadence gate:
 * - emits fixed-window and rolling-window verdict artifacts,
 * - prevents burst-splitting evasion via overlapping rolling aggregate checks,
 * - returns deterministic cadence-budget-exceeded when aggregate risk breaches.
 */
export const evaluateFeedbackCadenceTask1 = (
  windows: FeedbackCadenceWindow[],
  config: FeedbackCadenceTask1Config,
): FeedbackCadenceTask1Result => {
  validateConfig(config)
  if (!Array.isArray(windows) || windows.length < config.rollingWindowSpan) {
    throw new Error('insufficient-windows')
  }

  for (const window of windows) validateWindow(window)

  const fixedWindow = windows.map((window) => {
    const risk = singleWindowRisk(window)
    return {
      windowId: window.windowId,
      risk,
      velocity: velocity(window),
      overBudget: risk > config.maxSingleWindowRisk,
    } satisfies FixedWindowVerdict
  })

  const rollingWindow: RollingWindowVerdict[] = []
  for (let i = 0; i <= windows.length - config.rollingWindowSpan; i += 1) {
    const segment = windows.slice(i, i + config.rollingWindowSpan)
    const aggregateRisk = segment.reduce((sum, window) => sum + singleWindowRisk(window), 0)
    const velocities = segment.map((window) => velocity(window))
    const averageVelocity = velocities.reduce((sum, value) => sum + value, 0) / velocities.length
    const burstiness = Math.max(...velocities)

    rollingWindow.push({
      windowIds: segment.map((window) => window.windowId),
      aggregateRisk,
      averageVelocity,
      burstiness,
      overBudget:
        aggregateRisk > config.maxRollingWindowRisk || burstiness > config.maxBurstiness,
    })
  }

  const fixedExceeded = fixedWindow.some((entry) => entry.overBudget)
  const rollingExceeded = rollingWindow.some((entry) => entry.overBudget)

  if (fixedExceeded || rollingExceeded) {
    return {
      verdict: 'fail',
      reason: 'cadence-budget-exceeded',
      fixedWindow,
      rollingWindow,
    }
  }

  const warningRatio = clamp01(config.warningRatio ?? 0.85)
  const fixedWarning = fixedWindow.some(
    (entry) => entry.risk >= config.maxSingleWindowRisk * warningRatio,
  )
  const rollingWarning = rollingWindow.some(
    (entry) => entry.aggregateRisk >= config.maxRollingWindowRisk * warningRatio,
  )

  if (fixedWarning || rollingWarning) {
    return {
      verdict: 'pass',
      reason: 'cadence-warning',
      fixedWindow,
      rollingWindow,
    }
  }

  return {
    verdict: 'pass',
    reason: 'cadence-ok',
    fixedWindow,
    rollingWindow,
  }
}
