import { describe, expect, it } from 'bun:test'
import {
  evaluateConditionalCommitmentTask1,
  simulateCollusiveExploitEv,
  type ConditionalCommitmentTask1Config,
  type ConditionalCommitmentTask1Input,
} from '../src/conditional-commitment-schedule'

const CONFIG: ConditionalCommitmentTask1Config = {
  bonusCap: 3,
  minAdversarialPressure: 0.6,
  maxCounterpartyConcentration: 0.7,
  minDistinctCounterparties: 2,
  minRepeatPairings: 3,
  pairFarmingPenalty: 2,
}

const mkInput = (overrides?: Partial<ConditionalCommitmentTask1Input>): ConditionalCommitmentTask1Input => ({
  requestedBonus: 5,
  currentCounterparty: '0xA',
  pairHistory: [
    { counterparty: '0xA' },
    { counterparty: '0xB' },
  ],
  evidence: {
    adversarialPressure: 0.9,
    verificationChecks: ['turn-diversity', 'abuse-scan'],
  },
  ...overrides,
})

describe('conditional commitment task-1', () => {
  it('caps vested bonus by configured cap when eligibility checks pass', () => {
    const result = evaluateConditionalCommitmentTask1(CONFIG, mkInput())

    expect(result.bonusReason).toBe('bonus-vested')
    expect(result.requestedBonus).toBe(5)
    expect(result.cappedBonus).toBe(3)
    expect(result.vestedBonus).toBe(3)
  })

  it('fails vesting deterministically when adversarial evidence is insufficient', () => {
    const lowEvidenceInput = mkInput({
      evidence: {
        adversarialPressure: 0.2,
        verificationChecks: ['minimal'],
      },
    })

    const a = evaluateConditionalCommitmentTask1(CONFIG, lowEvidenceInput)
    const b = evaluateConditionalCommitmentTask1(CONFIG, lowEvidenceInput)

    expect(a.bonusReason).toBe('insufficient-adversarial-evidence')
    expect(a.vestedBonus).toBe(0)
    expect(a).toEqual(b)
  })

  it('emits deterministic pair-farming flags and blocks bonus on collusive pattern', () => {
    const collusiveInput = mkInput({
      currentCounterparty: '0xA',
      pairHistory: [
        { counterparty: '0xA' },
        { counterparty: '0xA' },
        { counterparty: '0xA' },
      ],
      evidence: {
        adversarialPressure: 0.8,
        verificationChecks: ['turn-diversity'],
      },
    })

    const result = evaluateConditionalCommitmentTask1(CONFIG, collusiveInput)

    expect(result.pairFarmingFlags.repeatedPairing).toBe(true)
    expect(result.pairFarmingFlags.lowCounterpartyDiversity).toBe(true)
    expect(result.pairFarmingFlags.isPairFarming).toBe(true)
    expect(result.bonusReason).toBe('pair-farming-detected')
    expect(result.vestedBonus).toBe(0)
    expect(result.abusePenaltyApplied).toBe(CONFIG.pairFarmingPenalty)
  })

  it('collusive opt-in fixture cannot generate net positive exploit EV', () => {
    const simulation = simulateCollusiveExploitEv(CONFIG, {
      rounds: 6,
      requestedBonusPerRound: 5,
      baseEvPerRound: 0,
      counterparty: '0xA',
      evidence: {
        adversarialPressure: 0.7,
        verificationChecks: ['minimal-pass'],
      },
    })

    expect(simulation.totalNetDelta).toBeLessThanOrEqual(0)
    expect(simulation.totalWithSchedule).toBeLessThanOrEqual(0)
  })
})
