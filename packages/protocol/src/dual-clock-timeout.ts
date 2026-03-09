export interface DualClockTimeoutConfig {
  /** Effective confirm threshold in [0,1]. */
  confirmThreshold: number
  /** Hard upper bound on consecutive suspect ticks before forced confirm. */
  maxSuspectTicks: number
  /** Debt added each time state enters suspect. */
  debtPerSuspectCycle: number
  /** Convert debt to score bonus: debtBonus = debt / debtToScoreScale. */
  debtToScoreScale: number
  /** Cap debt bonus to avoid runaway score inflation. */
  maxDebtBonus: number
}

export type TimeoutStatus = 'clear' | 'suspect' | 'confirmed'

export interface DualClockTimeoutState {
  status: TimeoutStatus
  suspectTicks: number
  suspectCycles: number
  debtScore: number
}

export interface DualClockTimeoutInput {
  /** Timeout condition for this tick/window. */
  timeoutExceeded: boolean
  /** Progress proof observed this tick. */
  progressObserved: boolean
  /** Corroboration confidence in [0,1] from external evidence bundle. */
  corroborationScore: number
}

export type TimeoutDecisionReason =
  | 'already-confirmed'
  | 'clear-no-timeout'
  | 'enter-suspect'
  | 'remain-suspect'
  | 'progress-cleared'
  | 'confirm-score'
  | 'confirm-bounded-suspect'

export interface DualClockTimeoutDecision {
  stateBefore: TimeoutStatus
  stateAfter: TimeoutStatus
  reason: TimeoutDecisionReason
  effectiveConfirmScore: number
}

export interface DualClockTimeoutStep {
  state: DualClockTimeoutState
  decision: DualClockTimeoutDecision
}

export interface SuspectFarmingSimulationInput {
  rounds: number
  rewardPerRound: number
  confirmationPenalty: number
  corroborationScore: number
  config: DualClockTimeoutConfig
}

export interface SuspectFarmingSimulationResult {
  baselineEv: number
  hardenedEv: number
  confirmedAtRound: number | null
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

const validateConfig = (config: DualClockTimeoutConfig): void => {
  if (!Number.isFinite(config.confirmThreshold) || config.confirmThreshold < 0 || config.confirmThreshold > 1) {
    throw new Error(`Invalid confirmThreshold: ${config.confirmThreshold}`)
  }
  if (!Number.isInteger(config.maxSuspectTicks) || config.maxSuspectTicks < 1) {
    throw new Error(`Invalid maxSuspectTicks: ${config.maxSuspectTicks}`)
  }
  if (!Number.isFinite(config.debtPerSuspectCycle) || config.debtPerSuspectCycle < 0) {
    throw new Error(`Invalid debtPerSuspectCycle: ${config.debtPerSuspectCycle}`)
  }
  if (!Number.isFinite(config.debtToScoreScale) || config.debtToScoreScale <= 0) {
    throw new Error(`Invalid debtToScoreScale: ${config.debtToScoreScale}`)
  }
  if (!Number.isFinite(config.maxDebtBonus) || config.maxDebtBonus < 0 || config.maxDebtBonus > 1) {
    throw new Error(`Invalid maxDebtBonus: ${config.maxDebtBonus}`)
  }
}

const debtBonus = (state: DualClockTimeoutState, config: DualClockTimeoutConfig): number => {
  const raw = state.debtScore / config.debtToScoreScale
  return Math.min(config.maxDebtBonus, Math.max(0, raw))
}

const effectiveConfirmScore = (
  state: DualClockTimeoutState,
  input: DualClockTimeoutInput,
  config: DualClockTimeoutConfig,
): number => {
  return clamp01(clamp01(input.corroborationScore) + debtBonus(state, config))
}

export const createInitialDualClockTimeoutState = (): DualClockTimeoutState => ({
  status: 'clear',
  suspectTicks: 0,
  suspectCycles: 0,
  debtScore: 0,
})

/**
 * Simulation-only timeout state machine for Task-1 hardening.
 *
 * Guarantees:
 * - suspect state cannot remain unresolved indefinitely,
 * - repeated suspect cycles increase debt and confirm likelihood,
 * - deterministic bounded fallback confirms after maxSuspectTicks.
 */
export const evaluateDualClockTimeoutTick = (
  config: DualClockTimeoutConfig,
  state: DualClockTimeoutState,
  input: DualClockTimeoutInput,
): DualClockTimeoutStep => {
  validateConfig(config)

  if (state.status === 'confirmed') {
    return {
      state,
      decision: {
        stateBefore: 'confirmed',
        stateAfter: 'confirmed',
        reason: 'already-confirmed',
        effectiveConfirmScore: 1,
      },
    }
  }

  const before = state.status

  if (!input.timeoutExceeded) {
    return {
      state: {
        ...state,
        status: 'clear',
        suspectTicks: 0,
      },
      decision: {
        stateBefore: before,
        stateAfter: 'clear',
        reason: 'clear-no-timeout',
        effectiveConfirmScore: 0,
      },
    }
  }

  if (before === 'clear') {
    const entered: DualClockTimeoutState = {
      ...state,
      status: 'suspect',
      suspectTicks: 1,
      suspectCycles: state.suspectCycles + 1,
      debtScore: state.debtScore + config.debtPerSuspectCycle,
    }

    const score = effectiveConfirmScore(entered, input, config)
    if (score >= config.confirmThreshold) {
      return {
        state: { ...entered, status: 'confirmed' },
        decision: {
          stateBefore: before,
          stateAfter: 'confirmed',
          reason: 'confirm-score',
          effectiveConfirmScore: score,
        },
      }
    }

    if (entered.suspectTicks >= config.maxSuspectTicks) {
      return {
        state: { ...entered, status: 'confirmed' },
        decision: {
          stateBefore: before,
          stateAfter: 'confirmed',
          reason: 'confirm-bounded-suspect',
          effectiveConfirmScore: score,
        },
      }
    }

    return {
      state: entered,
      decision: {
        stateBefore: before,
        stateAfter: 'suspect',
        reason: 'enter-suspect',
        effectiveConfirmScore: score,
      },
    }
  }

  // before === 'suspect'
  if (input.progressObserved) {
    const cleared: DualClockTimeoutState = {
      ...state,
      status: 'clear',
      suspectTicks: 0,
    }
    return {
      state: cleared,
      decision: {
        stateBefore: before,
        stateAfter: 'clear',
        reason: 'progress-cleared',
        effectiveConfirmScore: 0,
      },
    }
  }

  const advanced: DualClockTimeoutState = {
    ...state,
    status: 'suspect',
    suspectTicks: state.suspectTicks + 1,
  }

  const score = effectiveConfirmScore(advanced, input, config)
  if (score >= config.confirmThreshold) {
    return {
      state: { ...advanced, status: 'confirmed' },
      decision: {
        stateBefore: before,
        stateAfter: 'confirmed',
        reason: 'confirm-score',
        effectiveConfirmScore: score,
      },
    }
  }

  if (advanced.suspectTicks >= config.maxSuspectTicks) {
    return {
      state: { ...advanced, status: 'confirmed' },
      decision: {
        stateBefore: before,
        stateAfter: 'confirmed',
        reason: 'confirm-bounded-suspect',
        effectiveConfirmScore: score,
      },
    }
  }

  return {
    state: advanced,
    decision: {
      stateBefore: before,
      stateAfter: 'suspect',
      reason: 'remain-suspect',
      effectiveConfirmScore: score,
    },
  }
}

/**
 * Tiny EV harness for suspect-loop farming.
 * Baseline model assumes attacker can farm reward every round without forced confirmation.
 */
export const simulateSuspectFarmingExpectedValue = (
  input: SuspectFarmingSimulationInput,
): SuspectFarmingSimulationResult => {
  if (!Number.isInteger(input.rounds) || input.rounds < 1) {
    throw new Error(`Invalid rounds: ${input.rounds}`)
  }

  const baselineEv = input.rounds * input.rewardPerRound

  let hardenedEv = 0
  let confirmedAtRound: number | null = null
  let state = createInitialDualClockTimeoutState()

  for (let round = 1; round <= input.rounds; round += 1) {
    const suspectStep = evaluateDualClockTimeoutTick(input.config, state, {
      timeoutExceeded: true,
      progressObserved: false,
      corroborationScore: input.corroborationScore,
    })

    hardenedEv += input.rewardPerRound
    state = suspectStep.state

    if (state.status === 'confirmed') {
      hardenedEv -= input.confirmationPenalty
      confirmedAtRound = round
      break
    }

    // Attacker tries to reset suspect state without being confirmed.
    const clearStep = evaluateDualClockTimeoutTick(input.config, state, {
      timeoutExceeded: false,
      progressObserved: true,
      corroborationScore: 0,
    })
    state = clearStep.state
  }

  return {
    baselineEv,
    hardenedEv,
    confirmedAtRound,
  }
}
