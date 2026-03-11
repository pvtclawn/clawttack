import { createHash } from 'node:crypto'

export type TimeoutOrderEquivalenceTask1Reason =
  | 'timeout-order-equivalent'
  | 'timeout-order-constraint-invalid'
  | 'timeout-order-constraint-incomplete'

export type TimeoutOrderConstraintKind = 'causal' | 'real-time'

export interface TimeoutOrderConstraint {
  constraintId: string
  operationId: string
  fromEventId: string
  toEventId: string
  kind: TimeoutOrderConstraintKind
  provenanceValid: boolean
}

export interface TimeoutOrderEquivalenceTask1Input {
  operationId: string
  requiredConstraints: TimeoutOrderConstraint[]
  candidateConstraints: TimeoutOrderConstraint[]
}

export interface TimeoutOrderEquivalenceTask1Result {
  verdict: 'pass' | 'fail'
  reason: TimeoutOrderEquivalenceTask1Reason
  invalidConstraintIds: string[]
  missingConstraintIds: string[]
  duplicateConstraintIds: string[]
  artifactHash: `0x${string}`
}

interface CanonicalConstraint {
  constraintId: string
  operationId: string
  fromEventId: string
  toEventId: string
  kind: TimeoutOrderConstraintKind
  provenanceValid: boolean
}

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(String(value))
}

const sha256 = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const normalizeId = (value: string): string => value.trim().toLowerCase()

const canonicalizeConstraint = (constraint: TimeoutOrderConstraint): CanonicalConstraint => ({
  constraintId: normalizeId(constraint.constraintId),
  operationId: normalizeId(constraint.operationId),
  fromEventId: normalizeId(constraint.fromEventId),
  toEventId: normalizeId(constraint.toEventId),
  kind: constraint.kind,
  provenanceValid: constraint.provenanceValid,
})

export const evaluateTimeoutOrderEquivalenceTask1 = (
  input: TimeoutOrderEquivalenceTask1Input,
): TimeoutOrderEquivalenceTask1Result => {
  const operationId = normalizeId(input.operationId)
  const requiredConstraints = input.requiredConstraints.map((constraint) => canonicalizeConstraint(constraint))
  const candidateConstraints = input.candidateConstraints.map((constraint) => canonicalizeConstraint(constraint))

  const invalidConstraintIds = candidateConstraints
    .filter(
      (constraint) =>
        !constraint.provenanceValid ||
        constraint.operationId !== operationId ||
        constraint.fromEventId === constraint.toEventId,
    )
    .map((constraint) => constraint.constraintId)
    .sort((a, b) => a.localeCompare(b))

  const requiredIds = requiredConstraints.map((constraint) => constraint.constraintId).sort((a, b) => a.localeCompare(b))
  const candidateIdCounts = new Map<string, number>()
  for (const constraint of candidateConstraints) {
    candidateIdCounts.set(constraint.constraintId, (candidateIdCounts.get(constraint.constraintId) ?? 0) + 1)
  }

  const duplicateConstraintIds = [...candidateIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([constraintId]) => constraintId)
    .sort((a, b) => a.localeCompare(b))

  const candidateConstraintSet = new Set(candidateConstraints.map((constraint) => constraint.constraintId))
  const missingConstraintIds = requiredIds
    .filter((constraintId) => !candidateConstraintSet.has(constraintId))
    .sort((a, b) => a.localeCompare(b))

  const payload = {
    operationId,
    requiredConstraints,
    candidateConstraints,
    invalidConstraintIds,
    missingConstraintIds,
    duplicateConstraintIds,
  }

  if (invalidConstraintIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-order-constraint-invalid',
      invalidConstraintIds,
      missingConstraintIds,
      duplicateConstraintIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-order-constraint-invalid' }),
    }
  }

  if (missingConstraintIds.length > 0 || duplicateConstraintIds.length > 0) {
    return {
      verdict: 'fail',
      reason: 'timeout-order-constraint-incomplete',
      invalidConstraintIds,
      missingConstraintIds,
      duplicateConstraintIds,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'timeout-order-constraint-incomplete' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'timeout-order-equivalent',
    invalidConstraintIds,
    missingConstraintIds,
    duplicateConstraintIds,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'timeout-order-equivalent' }),
  }
}
