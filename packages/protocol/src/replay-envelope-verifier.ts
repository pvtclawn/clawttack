export interface ReplayEnvelopeConfig {
  maxResyncAttempts: number
}

export interface ReplayEnvelopeState {
  lastAcceptedTurnNumber: number
  lastAcceptedTurnHash: `0x${string}`
}

export interface ReplayEnvelopeInput {
  battleId: string
  agentAddress: `0x${string}`
  turnNumber: number
  expectedPreviousTurnHash: `0x${string}`
  currentTurnHash: `0x${string}`
}

export interface ChainAuthoritativeState {
  turnNumber: number
  turnHash: `0x${string}`
}

export type ReplayDecisionReason =
  | 'ok'
  | 'duplicate-counter'
  | 'out-of-order'
  | 'transient-desync'
  | 'resync-attempts-exhausted'
  | 'prev-hash-mismatch'

export interface ReplayEnvelopeDecision {
  status: 'accept' | 'needs-resync' | 'reject-terminal'
  reason: ReplayDecisionReason
  expectedTurnNumber: number
  resyncTarget?: ReplayEnvelopeState
}

const validateConfig = (config: ReplayEnvelopeConfig): void => {
  if (!Number.isInteger(config.maxResyncAttempts) || config.maxResyncAttempts < 0) {
    throw new Error(`Invalid maxResyncAttempts: ${config.maxResyncAttempts}`)
  }
}

const validateTurnNumber = (turnNumber: number): void => {
  if (!Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new Error(`Invalid turnNumber: ${turnNumber}`)
  }
}

export const applyResyncTarget = (
  decision: ReplayEnvelopeDecision,
  state: ReplayEnvelopeState,
): ReplayEnvelopeState => {
  if (decision.status !== 'needs-resync' || !decision.resyncTarget) {
    return state
  }

  return decision.resyncTarget
}

/**
 * Simulation-only envelope verifier with deterministic, bounded resync behavior.
 *
 * Guarantees:
 * - duplicate/out-of-order payloads are terminally rejected,
 * - stale local counter/hash can be recovered via bounded resync,
 * - reason codes are deterministic for replay/audit fixtures.
 */
export const verifyReplayEnvelope = (
  config: ReplayEnvelopeConfig,
  state: ReplayEnvelopeState,
  envelope: ReplayEnvelopeInput,
  chainState: ChainAuthoritativeState,
  resyncAttempts: number,
): ReplayEnvelopeDecision => {
  validateConfig(config)
  validateTurnNumber(state.lastAcceptedTurnNumber + 1)
  validateTurnNumber(envelope.turnNumber)
  validateTurnNumber(chainState.turnNumber)

  const expectedTurnNumber = state.lastAcceptedTurnNumber + 1

  if (envelope.turnNumber <= state.lastAcceptedTurnNumber) {
    return {
      status: 'reject-terminal',
      reason: 'duplicate-counter',
      expectedTurnNumber,
    }
  }

  const canResyncToChain =
    chainState.turnHash === envelope.expectedPreviousTurnHash &&
    chainState.turnNumber >= state.lastAcceptedTurnNumber &&
    envelope.turnNumber === chainState.turnNumber + 1

  if (envelope.turnNumber > expectedTurnNumber) {
    if (!canResyncToChain) {
      return {
        status: 'reject-terminal',
        reason: 'out-of-order',
        expectedTurnNumber,
      }
    }

    if (resyncAttempts >= config.maxResyncAttempts) {
      return {
        status: 'reject-terminal',
        reason: 'resync-attempts-exhausted',
        expectedTurnNumber,
      }
    }

    return {
      status: 'needs-resync',
      reason: 'transient-desync',
      expectedTurnNumber,
      resyncTarget: {
        lastAcceptedTurnNumber: chainState.turnNumber,
        lastAcceptedTurnHash: chainState.turnHash,
      },
    }
  }

  if (envelope.expectedPreviousTurnHash === state.lastAcceptedTurnHash) {
    return {
      status: 'accept',
      reason: 'ok',
      expectedTurnNumber,
    }
  }

  if (!canResyncToChain) {
    return {
      status: 'reject-terminal',
      reason: 'prev-hash-mismatch',
      expectedTurnNumber,
    }
  }

  if (resyncAttempts >= config.maxResyncAttempts) {
    return {
      status: 'reject-terminal',
      reason: 'resync-attempts-exhausted',
      expectedTurnNumber,
    }
  }

  return {
    status: 'needs-resync',
    reason: 'transient-desync',
    expectedTurnNumber,
    resyncTarget: {
      lastAcceptedTurnNumber: chainState.turnNumber,
      lastAcceptedTurnHash: chainState.turnHash,
    },
  }
}
