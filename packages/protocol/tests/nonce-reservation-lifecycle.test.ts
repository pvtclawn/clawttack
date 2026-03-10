import { describe, expect, it } from 'bun:test'
import {
  computeReservationBindingHash,
  evaluateReservationLifecycle,
  type NonceReservation,
} from '../src/nonce-reservation-lifecycle'

const mkReservation = (overrides?: Partial<NonceReservation>): NonceReservation => {
  const base: NonceReservation = {
    reservationId: 'rsv-1',
    scopeKey: '84532:0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e:0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af',
    intentId: 'intent-101',
    ownerToken: 42,
    epoch: 9,
    expiresAtMs: 2_000,
    ownerLastSeenMs: 1_800,
    status: 'active',
    bindingHash: '0x0',
  }

  const reservation = { ...base, ...overrides }
  reservation.bindingHash = computeReservationBindingHash({
    scopeKey: reservation.scopeKey,
    intentId: reservation.intentId,
    ownerToken: reservation.ownerToken,
    epoch: reservation.epoch,
    reservationId: reservation.reservationId,
  })

  return reservation
}

describe('nonce reservation lifecycle task-1', () => {
  it('passes for valid active reservation with matching owner token', () => {
    const reservation = mkReservation()

    const result = evaluateReservationLifecycle({
      nowMs: 1_900,
      staleOwnerAfterMs: 500,
      expectedScopeKey: reservation.scopeKey,
      expectedIntentId: reservation.intentId,
      actorToken: 42,
      activeToken: 42,
      reservation,
    })

    expect(result).toEqual({
      allowSubmit: true,
      reason: 'pass',
      shouldCleanup: false,
    })
  })

  it('rejects stale owner token deterministically', () => {
    const reservation = mkReservation()

    const result = evaluateReservationLifecycle({
      nowMs: 1_900,
      staleOwnerAfterMs: 500,
      expectedScopeKey: reservation.scopeKey,
      expectedIntentId: reservation.intentId,
      actorToken: 41,
      activeToken: 42,
      reservation,
    })

    expect(result).toEqual({
      allowSubmit: false,
      reason: 'stale-owner-token',
      shouldCleanup: false,
    })
  })

  it('rejects binding mismatch (scope/intent/hash) with deterministic reason', () => {
    const reservation = mkReservation({ intentId: 'intent-999' })

    const result = evaluateReservationLifecycle({
      nowMs: 1_900,
      staleOwnerAfterMs: 500,
      expectedScopeKey: reservation.scopeKey,
      expectedIntentId: 'intent-101',
      actorToken: 42,
      activeToken: 42,
      reservation,
    })

    expect(result).toEqual({
      allowSubmit: false,
      reason: 'reservation-binding-invalid',
      shouldCleanup: false,
    })
  })

  it('emits reservation-expired-cleanup on ttl expiry', () => {
    const reservation = mkReservation({ expiresAtMs: 1_850 })

    const result = evaluateReservationLifecycle({
      nowMs: 1_900,
      staleOwnerAfterMs: 500,
      expectedScopeKey: reservation.scopeKey,
      expectedIntentId: reservation.intentId,
      actorToken: 42,
      activeToken: 42,
      reservation,
    })

    expect(result).toEqual({
      allowSubmit: false,
      reason: 'reservation-expired-cleanup',
      shouldCleanup: true,
    })
  })

  it('emits reservation-expired-cleanup when owner heartbeat is stale', () => {
    const reservation = mkReservation({ ownerLastSeenMs: 1_200 })

    const result = evaluateReservationLifecycle({
      nowMs: 1_900,
      staleOwnerAfterMs: 500,
      expectedScopeKey: reservation.scopeKey,
      expectedIntentId: reservation.intentId,
      actorToken: 42,
      activeToken: 42,
      reservation,
    })

    expect(result).toEqual({
      allowSubmit: false,
      reason: 'reservation-expired-cleanup',
      shouldCleanup: true,
    })
  })
})
