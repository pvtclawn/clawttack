import { describe, expect, it } from 'bun:test'
import {
  createInitialDualClockTimeoutState,
  evaluateDualClockTimeoutTick,
  simulateSuspectFarmingExpectedValue,
  type DualClockTimeoutConfig,
} from '../src/dual-clock-timeout'

const CONFIG: DualClockTimeoutConfig = {
  confirmThreshold: 0.7,
  maxSuspectTicks: 3,
  debtPerSuspectCycle: 0.2,
  debtToScoreScale: 1,
  maxDebtBonus: 0.8,
}

describe('dual-clock timeout task-1 hardening', () => {
  it('cannot remain in suspect state indefinitely under adversarial no-progress loop', () => {
    let state = createInitialDualClockTimeoutState()

    for (let i = 0; i < 20; i += 1) {
      const step = evaluateDualClockTimeoutTick(CONFIG, state, {
        timeoutExceeded: true,
        progressObserved: false,
        corroborationScore: 0,
      })
      state = step.state
      if (state.status === 'confirmed') break
    }

    expect(state.status).toBe('confirmed')
  })

  it('resolves suspect state within maxSuspectTicks bound by deterministic fallback', () => {
    const strictConfig: DualClockTimeoutConfig = {
      ...CONFIG,
      confirmThreshold: 0.99,
      debtPerSuspectCycle: 0,
      maxSuspectTicks: 2,
    }

    let state = createInitialDualClockTimeoutState()

    const step1 = evaluateDualClockTimeoutTick(strictConfig, state, {
      timeoutExceeded: true,
      progressObserved: false,
      corroborationScore: 0,
    })
    state = step1.state
    expect(state.status).toBe('suspect')

    const step2 = evaluateDualClockTimeoutTick(strictConfig, state, {
      timeoutExceeded: true,
      progressObserved: false,
      corroborationScore: 0,
    })

    expect(step2.state.status).toBe('confirmed')
    expect(step2.decision.reason).toBe('confirm-bounded-suspect')
  })

  it('debt from repeated suspect cycles raises confirm likelihood and makes farming EV non-positive', () => {
    const result = simulateSuspectFarmingExpectedValue({
      rounds: 10,
      rewardPerRound: 1,
      confirmationPenalty: 4,
      corroborationScore: 0.1,
      config: CONFIG,
    })

    expect(result.baselineEv).toBeGreaterThan(0)
    expect(result.confirmedAtRound).not.toBeNull()
    expect(result.hardenedEv).toBeLessThanOrEqual(0)
  })
})
