export interface ContextGrowthBudgetConfig {
  softThreshold: number
  hardThreshold: number
  windowSize: number
  nearThresholdMargin: number
  warningDebtPerNearThreshold: number
  warningDebtLimit: number
}

export interface ContextGrowthStepInput {
  promptDeltaEstimate: number
  toolTraceDeltaEstimate: number
  cumulativeContextRatio: number
}

export interface ContextGrowthBudgetState {
  halted: boolean
  haltReason?: 'context-budget-exceeded'
  warningDebt: number
  recentRatios: number[]
  step: number
}

export type ContextGrowthDecisionReason =
  | 'ok'
  | 'context-growth-warning'
  | 'near-threshold-escalation'
  | 'context-budget-exceeded'
  | 'already-halted'

export interface ContextGrowthBudgetDecision {
  halted: boolean
  reason: ContextGrowthDecisionReason
  movingWindowRatio: number
  warningDebt: number
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

const average = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const validateConfig = (config: ContextGrowthBudgetConfig): void => {
  if (!Number.isFinite(config.softThreshold) || !Number.isFinite(config.hardThreshold)) {
    throw new Error('invalid-thresholds')
  }
  if (config.softThreshold < 0 || config.softThreshold > 1) {
    throw new Error('invalid-soft-threshold')
  }
  if (config.hardThreshold < 0 || config.hardThreshold > 1 || config.hardThreshold < config.softThreshold) {
    throw new Error('invalid-hard-threshold')
  }
  if (!Number.isInteger(config.windowSize) || config.windowSize < 1) {
    throw new Error('invalid-window-size')
  }
  if (!Number.isFinite(config.nearThresholdMargin) || config.nearThresholdMargin < 0 || config.nearThresholdMargin > 1) {
    throw new Error('invalid-near-threshold-margin')
  }
  if (!Number.isFinite(config.warningDebtPerNearThreshold) || config.warningDebtPerNearThreshold < 0) {
    throw new Error('invalid-warning-debt-per-near-threshold')
  }
  if (!Number.isFinite(config.warningDebtLimit) || config.warningDebtLimit < 0) {
    throw new Error('invalid-warning-debt-limit')
  }
}

export const createInitialContextGrowthBudgetState = (): ContextGrowthBudgetState => ({
  halted: false,
  warningDebt: 0,
  recentRatios: [],
  step: 0,
})

/**
 * Simulation-only context-growth budget checker.
 *
 * Task-1 guarantees:
 * - moving-window utilization (not point-only) contributes to warning/halt decisions,
 * - repeated near-threshold occupancy accumulates warning debt and deterministically escalates,
 * - hard threshold breaches halt deterministically.
 */
export const evaluateContextGrowthBudgetStep = (
  config: ContextGrowthBudgetConfig,
  state: ContextGrowthBudgetState,
  input: ContextGrowthStepInput,
): { state: ContextGrowthBudgetState; decision: ContextGrowthBudgetDecision } => {
  validateConfig(config)

  if (state.halted) {
    return {
      state,
      decision: {
        halted: true,
        reason: 'already-halted',
        movingWindowRatio: average(state.recentRatios),
        warningDebt: state.warningDebt,
      },
    }
  }

  const ratio = clamp01(input.cumulativeContextRatio)
  const nextRecent = [...state.recentRatios, ratio].slice(-config.windowSize)
  const movingWindowRatio = average(nextRecent)

  const nearThresholdLower = Math.max(0, config.softThreshold - config.nearThresholdMargin)
  const isNearThreshold = ratio >= nearThresholdLower && ratio < config.softThreshold
  const nextWarningDebt = isNearThreshold
    ? state.warningDebt + config.warningDebtPerNearThreshold
    : Math.max(0, state.warningDebt - config.warningDebtPerNearThreshold)

  const nextStateBase: ContextGrowthBudgetState = {
    ...state,
    warningDebt: nextWarningDebt,
    recentRatios: nextRecent,
    step: state.step + 1,
  }

  const hardBreach = ratio >= config.hardThreshold || movingWindowRatio >= config.hardThreshold
  if (hardBreach) {
    const haltedState: ContextGrowthBudgetState = {
      ...nextStateBase,
      halted: true,
      haltReason: 'context-budget-exceeded',
    }

    return {
      state: haltedState,
      decision: {
        halted: true,
        reason: 'context-budget-exceeded',
        movingWindowRatio,
        warningDebt: nextWarningDebt,
      },
    }
  }

  const softWarning = ratio >= config.softThreshold || movingWindowRatio >= config.softThreshold
  if (softWarning) {
    return {
      state: nextStateBase,
      decision: {
        halted: false,
        reason: 'context-growth-warning',
        movingWindowRatio,
        warningDebt: nextWarningDebt,
      },
    }
  }

  if (nextWarningDebt >= config.warningDebtLimit) {
    return {
      state: nextStateBase,
      decision: {
        halted: false,
        reason: 'near-threshold-escalation',
        movingWindowRatio,
        warningDebt: nextWarningDebt,
      },
    }
  }

  return {
    state: nextStateBase,
    decision: {
      halted: false,
      reason: 'ok',
      movingWindowRatio,
      warningDebt: nextWarningDebt,
    },
  }
}
