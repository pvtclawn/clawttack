const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export interface ConditionalCommitmentTask1Config {
  bonusCap: number
  minAdversarialPressure: number
  maxCounterpartyConcentration: number
  minDistinctCounterparties: number
  minRepeatPairings: number
  pairFarmingPenalty: number
}

export interface CommitmentEvidence {
  adversarialPressure: number
  verificationChecks: string[]
}

export interface PairHistoryEntry {
  counterparty: string
}

export interface ConditionalCommitmentTask1Input {
  requestedBonus: number
  currentCounterparty: string
  pairHistory: PairHistoryEntry[]
  evidence: CommitmentEvidence
}

export interface PairFarmingFlags {
  counterpartyConcentration: number
  repeatedPairing: boolean
  lowCounterpartyDiversity: boolean
  lowAdversarialPressure: boolean
  isPairFarming: boolean
}

export type CommitmentBonusReason =
  | 'bonus-vested'
  | 'insufficient-adversarial-evidence'
  | 'pair-farming-detected'

export interface ConditionalCommitmentTask1Result {
  requestedBonus: number
  cappedBonus: number
  vestedBonus: number
  bonusReason: CommitmentBonusReason
  pairFarmingFlags: PairFarmingFlags
  abusePenaltyApplied: number
  netDelta: number
}

export interface CollusiveExploitScenario {
  rounds: number
  requestedBonusPerRound: number
  baseEvPerRound: number
  counterparty: string
  evidence: CommitmentEvidence
}

export interface CollusiveExploitSimulationResult {
  totalNetDelta: number
  totalBaseEv: number
  totalWithSchedule: number
  rounds: number
}

const validateConfig = (config: ConditionalCommitmentTask1Config): void => {
  if (!Number.isFinite(config.bonusCap) || config.bonusCap < 0) {
    throw new Error('invalid-bonus-cap')
  }
  if (!Number.isFinite(config.pairFarmingPenalty) || config.pairFarmingPenalty < 0) {
    throw new Error('invalid-pair-farming-penalty')
  }
  if (!Number.isFinite(config.minAdversarialPressure) || config.minAdversarialPressure < 0 || config.minAdversarialPressure > 1) {
    throw new Error('invalid-min-adversarial-pressure')
  }
  if (!Number.isFinite(config.maxCounterpartyConcentration) || config.maxCounterpartyConcentration < 0 || config.maxCounterpartyConcentration > 1) {
    throw new Error('invalid-max-counterparty-concentration')
  }
  if (!Number.isInteger(config.minDistinctCounterparties) || config.minDistinctCounterparties < 1) {
    throw new Error('invalid-min-distinct-counterparties')
  }
  if (!Number.isInteger(config.minRepeatPairings) || config.minRepeatPairings < 1) {
    throw new Error('invalid-min-repeat-pairings')
  }
}

const computePairFarmingFlags = (
  config: ConditionalCommitmentTask1Config,
  input: ConditionalCommitmentTask1Input,
): PairFarmingFlags => {
  const total = input.pairHistory.length + 1
  const sameCounterpartyCount =
    input.pairHistory.filter((entry) => entry.counterparty === input.currentCounterparty).length + 1

  const distinct = new Set([
    ...input.pairHistory.map((entry) => entry.counterparty),
    input.currentCounterparty,
  ]).size

  const counterpartyConcentration = sameCounterpartyCount / total
  const repeatedPairing = sameCounterpartyCount >= config.minRepeatPairings
  const lowCounterpartyDiversity = distinct < config.minDistinctCounterparties
  const lowAdversarialPressure =
    clamp01(input.evidence.adversarialPressure) < clamp01(config.minAdversarialPressure)

  const isPairFarming =
    repeatedPairing &&
    (counterpartyConcentration > config.maxCounterpartyConcentration ||
      lowCounterpartyDiversity ||
      lowAdversarialPressure)

  return {
    counterpartyConcentration,
    repeatedPairing,
    lowCounterpartyDiversity,
    lowAdversarialPressure,
    isPairFarming,
  }
}

/**
 * Task-1 conditional commitment evaluator.
 *
 * Guarantees:
 * - bonus is capped by configuration,
 * - bonus vesting requires adversarial-quality evidence,
 * - pair-farming flags are deterministic and emitted in artifact fields.
 */
export const evaluateConditionalCommitmentTask1 = (
  config: ConditionalCommitmentTask1Config,
  input: ConditionalCommitmentTask1Input,
): ConditionalCommitmentTask1Result => {
  validateConfig(config)

  const requestedBonus = Math.max(0, input.requestedBonus)
  const cappedBonus = Math.min(requestedBonus, config.bonusCap)

  const flags = computePairFarmingFlags(config, input)

  if (flags.lowAdversarialPressure) {
    return {
      requestedBonus,
      cappedBonus,
      vestedBonus: 0,
      bonusReason: 'insufficient-adversarial-evidence',
      pairFarmingFlags: flags,
      abusePenaltyApplied: flags.isPairFarming ? config.pairFarmingPenalty : 0,
      netDelta: flags.isPairFarming ? -config.pairFarmingPenalty : 0,
    }
  }

  if (flags.isPairFarming) {
    return {
      requestedBonus,
      cappedBonus,
      vestedBonus: 0,
      bonusReason: 'pair-farming-detected',
      pairFarmingFlags: flags,
      abusePenaltyApplied: config.pairFarmingPenalty,
      netDelta: -config.pairFarmingPenalty,
    }
  }

  return {
    requestedBonus,
    cappedBonus,
    vestedBonus: cappedBonus,
    bonusReason: 'bonus-vested',
    pairFarmingFlags: flags,
    abusePenaltyApplied: 0,
    netDelta: cappedBonus,
  }
}

/**
 * Collusive exploit EV harness: repeatedly evaluates the same counterparty path.
 */
export const simulateCollusiveExploitEv = (
  config: ConditionalCommitmentTask1Config,
  scenario: CollusiveExploitScenario,
): CollusiveExploitSimulationResult => {
  if (!Number.isInteger(scenario.rounds) || scenario.rounds < 1) {
    throw new Error('invalid-rounds')
  }

  const pairHistory: PairHistoryEntry[] = []
  let totalNetDelta = 0

  for (let round = 0; round < scenario.rounds; round += 1) {
    const result = evaluateConditionalCommitmentTask1(config, {
      requestedBonus: scenario.requestedBonusPerRound,
      currentCounterparty: scenario.counterparty,
      pairHistory,
      evidence: scenario.evidence,
    })

    totalNetDelta += result.netDelta
    pairHistory.push({ counterparty: scenario.counterparty })
  }

  const totalBaseEv = scenario.rounds * scenario.baseEvPerRound
  return {
    rounds: scenario.rounds,
    totalNetDelta,
    totalBaseEv,
    totalWithSchedule: totalBaseEv + totalNetDelta,
  }
}
