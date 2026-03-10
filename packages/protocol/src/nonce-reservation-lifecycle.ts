import { createHash } from 'node:crypto'

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

const isFiniteNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0

export type NonceReservationStatus = 'active' | 'released' | 'expired'

export interface NonceReservation {
  reservationId: string
  scopeKey: string
  intentId: string
  ownerToken: number
  epoch: number
  expiresAtMs: number
  ownerLastSeenMs: number
  status: NonceReservationStatus
  bindingHash: `0x${string}`
}

export interface ReservationLifecycleInput {
  nowMs: number
  staleOwnerAfterMs: number
  expectedScopeKey: string
  expectedIntentId: string
  actorToken: number
  activeToken: number
  reservation?: NonceReservation | null
}

export type ReservationLifecycleReason =
  | 'pass'
  | 'reservation-missing'
  | 'stale-owner-token'
  | 'reservation-binding-invalid'
  | 'reservation-not-active'
  | 'reservation-expired-cleanup'

export interface ReservationLifecycleResult {
  allowSubmit: boolean
  reason: ReservationLifecycleReason
  shouldCleanup: boolean
}

export const computeReservationBindingHash = (params: {
  scopeKey: string
  intentId: string
  ownerToken: number
  epoch: number
  reservationId: string
}): `0x${string}` => {
  const digest = createHash('sha256')
    .update(stableStringify(params))
    .digest('hex')
  return `0x${digest}`
}

const isValidReservation = (reservation: NonceReservation): boolean => {
  if (!reservation.reservationId || reservation.reservationId.trim().length === 0) return false
  if (!reservation.scopeKey || reservation.scopeKey.trim().length === 0) return false
  if (!reservation.intentId || reservation.intentId.trim().length === 0) return false
  if (!reservation.bindingHash || !reservation.bindingHash.startsWith('0x')) return false
  if (!isFiniteNonNegativeInteger(reservation.ownerToken)) return false
  if (!isFiniteNonNegativeInteger(reservation.epoch)) return false
  if (!isFiniteNonNegativeInteger(reservation.expiresAtMs)) return false
  if (!isFiniteNonNegativeInteger(reservation.ownerLastSeenMs)) return false
  if (!['active', 'released', 'expired'].includes(reservation.status)) return false
  return true
}

/**
 * Task-1 misuse-resistant nonce mode verifier:
 * validates reservation ownership/binding and returns deterministic cleanup signals.
 */
export const evaluateReservationLifecycle = (
  input: ReservationLifecycleInput,
): ReservationLifecycleResult => {
  if (!input.reservation) {
    return {
      allowSubmit: false,
      reason: 'reservation-missing',
      shouldCleanup: false,
    }
  }

  const reservation = input.reservation
  if (
    !isFiniteNonNegativeInteger(input.nowMs) ||
    !isFiniteNonNegativeInteger(input.staleOwnerAfterMs) ||
    !isFiniteNonNegativeInteger(input.actorToken) ||
    !isFiniteNonNegativeInteger(input.activeToken) ||
    !isValidReservation(reservation)
  ) {
    return {
      allowSubmit: false,
      reason: 'reservation-binding-invalid',
      shouldCleanup: false,
    }
  }

  if (input.actorToken !== input.activeToken) {
    return {
      allowSubmit: false,
      reason: 'stale-owner-token',
      shouldCleanup: false,
    }
  }

  const expectedHash = computeReservationBindingHash({
    scopeKey: reservation.scopeKey,
    intentId: reservation.intentId,
    ownerToken: reservation.ownerToken,
    epoch: reservation.epoch,
    reservationId: reservation.reservationId,
  })

  const bindingMismatch =
    reservation.bindingHash !== expectedHash ||
    reservation.scopeKey !== input.expectedScopeKey ||
    reservation.intentId !== input.expectedIntentId ||
    reservation.ownerToken !== input.activeToken

  if (bindingMismatch) {
    return {
      allowSubmit: false,
      reason: 'reservation-binding-invalid',
      shouldCleanup: false,
    }
  }

  if (reservation.status !== 'active') {
    return {
      allowSubmit: false,
      reason: 'reservation-not-active',
      shouldCleanup: false,
    }
  }

  const ttlExpired = input.nowMs >= reservation.expiresAtMs
  const staleOwner = reservation.ownerLastSeenMs + input.staleOwnerAfterMs <= input.nowMs
  if (ttlExpired || staleOwner) {
    return {
      allowSubmit: false,
      reason: 'reservation-expired-cleanup',
      shouldCleanup: true,
    }
  }

  return {
    allowSubmit: true,
    reason: 'pass',
    shouldCleanup: false,
  }
}
