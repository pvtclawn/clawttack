export interface RandomizedHorizonConfig {
  /** Feature flag: keep false to preserve deterministic horizon behavior. */
  enabled: boolean;
  /** Turn threshold before randomized tail can begin. */
  minTurns: number;
  /** Deterministic maximum turn cap. */
  hardCap: number;
  /** Geometric tail stop probability, in [0, 1). */
  stopProbability: number;
}

export interface StopSamplingInput {
  /** Current turn number (1-indexed turn just accepted by protocol). */
  turnNumber: number;
  /** Turn acceptance gate — only accepted turns may trigger stop decisions. */
  turnAccepted: boolean;
  /** Timeout window gate — unresolved timeout windows must not sample stop. */
  timeoutPending: boolean;
  /** Guard against duplicate stop sampling for the same accepted turn. */
  alreadySampledThisTurn: boolean;
  /** Deterministic random scalar in [0, 1). */
  randomValue: number;
}

export type StopDecisionReason =
  | 'timeout-pending'
  | 'turn-not-accepted'
  | 'hard-cap'
  | 'feature-disabled'
  | 'below-min-turns'
  | 'random-tail-stop'
  | 'random-tail-continue';

export interface StopDecision {
  shouldSample: boolean;
  shouldStop: boolean;
  reason: StopDecisionReason;
}

function assertConfig(config: RandomizedHorizonConfig): void {
  if (!Number.isInteger(config.minTurns) || config.minTurns < 1) {
    throw new Error(`Invalid minTurns: ${config.minTurns}`);
  }
  if (!Number.isInteger(config.hardCap) || config.hardCap < config.minTurns) {
    throw new Error(`Invalid hardCap: ${config.hardCap} (minTurns=${config.minTurns})`);
  }
  if (!Number.isFinite(config.stopProbability) || config.stopProbability < 0 || config.stopProbability >= 1) {
    throw new Error(`Invalid stopProbability: ${config.stopProbability}`);
  }
}

function assertInput(input: StopSamplingInput): void {
  if (!Number.isInteger(input.turnNumber) || input.turnNumber < 1) {
    throw new Error(`Invalid turnNumber: ${input.turnNumber}`);
  }
  if (!Number.isFinite(input.randomValue) || input.randomValue < 0 || input.randomValue >= 1) {
    throw new Error(`Invalid randomValue: ${input.randomValue}`);
  }
}

/**
 * Evaluate one stop decision for a just-processed turn.
 *
 * Invariants:
 * 1) Timeout windows never sample stop.
 * 2) Only accepted turns can produce stop decisions.
 * 3) Hard cap remains deterministic fallback.
 */
export function evaluateStopDecision(
  config: RandomizedHorizonConfig,
  input: StopSamplingInput,
): StopDecision {
  assertConfig(config);
  assertInput(input);

  if (input.timeoutPending) {
    return { shouldSample: false, shouldStop: false, reason: 'timeout-pending' };
  }

  if (!input.turnAccepted) {
    return { shouldSample: false, shouldStop: false, reason: 'turn-not-accepted' };
  }

  if (input.turnNumber >= config.hardCap) {
    return { shouldSample: false, shouldStop: true, reason: 'hard-cap' };
  }

  if (!config.enabled) {
    return { shouldSample: false, shouldStop: false, reason: 'feature-disabled' };
  }

  if (input.turnNumber < config.minTurns) {
    return { shouldSample: false, shouldStop: false, reason: 'below-min-turns' };
  }

  if (input.alreadySampledThisTurn) {
    throw new Error(`Stop decision already sampled for turn ${input.turnNumber}`);
  }

  const shouldStop = input.randomValue < config.stopProbability;
  return {
    shouldSample: true,
    shouldStop,
    reason: shouldStop ? 'random-tail-stop' : 'random-tail-continue',
  };
}
