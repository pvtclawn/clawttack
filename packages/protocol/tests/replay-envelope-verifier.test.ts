import { describe, expect, it } from 'bun:test'
import {
  applyResyncTarget,
  verifyReplayEnvelope,
  type ChainAuthoritativeState,
  type ReplayEnvelopeConfig,
  type ReplayEnvelopeInput,
  type ReplayEnvelopeState,
} from '../src/replay-envelope-verifier'

const CONFIG: ReplayEnvelopeConfig = {
  maxResyncAttempts: 2,
}

const BASE_STATE: ReplayEnvelopeState = {
  lastAcceptedTurnNumber: 4,
  lastAcceptedTurnHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
}

const BASE_CHAIN: ChainAuthoritativeState = {
  turnNumber: 4,
  turnHash: BASE_STATE.lastAcceptedTurnHash,
}

const mkEnvelope = (overrides?: Partial<ReplayEnvelopeInput>): ReplayEnvelopeInput => ({
  battleId: 'battle-27',
  agentAddress: '0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af',
  turnNumber: 5,
  expectedPreviousTurnHash: BASE_STATE.lastAcceptedTurnHash,
  currentTurnHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
  ...overrides,
})

describe('replay-envelope verifier task-1', () => {
  it('accepts valid in-order envelope', () => {
    const decision = verifyReplayEnvelope(CONFIG, BASE_STATE, mkEnvelope(), BASE_CHAIN, 0)

    expect(decision.status).toBe('accept')
    expect(decision.reason).toBe('ok')
  })

  it('terminally rejects duplicate counters', () => {
    const decision = verifyReplayEnvelope(
      CONFIG,
      BASE_STATE,
      mkEnvelope({ turnNumber: 4 }),
      BASE_CHAIN,
      0,
    )

    expect(decision).toEqual({
      status: 'reject-terminal',
      reason: 'duplicate-counter',
      expectedTurnNumber: 5,
    })
  })

  it('terminally rejects out-of-order envelopes', () => {
    const decision = verifyReplayEnvelope(
      CONFIG,
      BASE_STATE,
      mkEnvelope({ turnNumber: 7 }),
      BASE_CHAIN,
      0,
    )

    expect(decision.reason).toBe('out-of-order')
    expect(decision.status).toBe('reject-terminal')
  })

  it('returns needs-resync for transient desync and accepts after applying resync target', () => {
    const staleState: ReplayEnvelopeState = {
      lastAcceptedTurnNumber: 3,
      lastAcceptedTurnHash:
        '0x3333333333333333333333333333333333333333333333333333333333333333',
    }

    const authoritative: ChainAuthoritativeState = {
      turnNumber: 4,
      turnHash: BASE_STATE.lastAcceptedTurnHash,
    }

    const envelope = mkEnvelope({
      turnNumber: 5,
      expectedPreviousTurnHash: authoritative.turnHash,
    })

    const desyncDecision = verifyReplayEnvelope(CONFIG, staleState, envelope, authoritative, 0)
    expect(desyncDecision.status).toBe('needs-resync')
    expect(desyncDecision.reason).toBe('transient-desync')

    const recoveredState = applyResyncTarget(desyncDecision, staleState)
    const acceptDecision = verifyReplayEnvelope(CONFIG, recoveredState, envelope, authoritative, 1)

    expect(acceptDecision.status).toBe('accept')
    expect(acceptDecision.reason).toBe('ok')
  })

  it('terminally rejects when resync attempt budget is exhausted', () => {
    const staleState: ReplayEnvelopeState = {
      lastAcceptedTurnNumber: 3,
      lastAcceptedTurnHash:
        '0x3333333333333333333333333333333333333333333333333333333333333333',
    }

    const authoritative: ChainAuthoritativeState = {
      turnNumber: 4,
      turnHash: BASE_STATE.lastAcceptedTurnHash,
    }

    const envelope = mkEnvelope({
      turnNumber: 5,
      expectedPreviousTurnHash: authoritative.turnHash,
    })

    const decision = verifyReplayEnvelope(CONFIG, staleState, envelope, authoritative, 2)
    expect(decision).toEqual({
      status: 'reject-terminal',
      reason: 'resync-attempts-exhausted',
      expectedTurnNumber: 4,
    })
  })

  it('keeps reason codes deterministic for identical input tuples', () => {
    const envelope = mkEnvelope({
      expectedPreviousTurnHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    const a = verifyReplayEnvelope(CONFIG, BASE_STATE, envelope, BASE_CHAIN, 0)
    const b = verifyReplayEnvelope(CONFIG, BASE_STATE, envelope, BASE_CHAIN, 0)

    expect(a).toEqual(b)
    expect(a.reason).toBe('prev-hash-mismatch')
  })
})
