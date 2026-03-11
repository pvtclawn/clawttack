import { createHash } from 'node:crypto'

import type { TacticOutputViewTask1Role } from './tactic-output-view-task1.ts'

export type TacticOutputCapabilityTask1Capability =
  | 'public-cap'
  | 'research-cap'
  | 'operator-cap'
  | 'verifier-cap'

export type TacticOutputCapabilityTask1Mode =
  | 'tactic-output-capability-allowed'
  | 'tactic-output-capability-downgraded'
  | 'tactic-output-capability-denied'

export interface TacticOutputCapabilityTask1Input {
  capability: TacticOutputCapabilityTask1Capability
  requestedRole: TacticOutputViewTask1Role
  blocked: boolean
  contextDenied: boolean
}

export interface TacticOutputCapabilityTask1Result {
  mode: TacticOutputCapabilityTask1Mode
  effectiveRole: TacticOutputViewTask1Role | null
  allowedRoles: TacticOutputViewTask1Role[]
  triggers: string[]
  artifactHash: `0x${string}`
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

const ROLE_ORDER: readonly TacticOutputViewTask1Role[] = [
  'public-reader',
  'research-metrics',
  'operator-debug',
  'internal-verifier',
] as const

const CAPABILITY_LATTICE: Record<TacticOutputCapabilityTask1Capability, TacticOutputViewTask1Role[]> = {
  'public-cap': ['public-reader'],
  'research-cap': ['public-reader', 'research-metrics'],
  'operator-cap': ['public-reader', 'research-metrics', 'operator-debug'],
  'verifier-cap': ['public-reader', 'research-metrics', 'operator-debug', 'internal-verifier'],
}

const roleRank = (role: TacticOutputViewTask1Role): number => ROLE_ORDER.indexOf(role)

const sortedUnique = (items: string[]): string[] => [...new Set(items)].sort((a, b) => a.localeCompare(b))

export const evaluateTacticOutputCapabilityTask1 = (
  input: TacticOutputCapabilityTask1Input,
): TacticOutputCapabilityTask1Result => {
  const allowedRoles = [...CAPABILITY_LATTICE[input.capability]]
  const triggers: string[] = []

  if (input.blocked) {
    triggers.push('policy:blocked')
  }

  if (input.contextDenied) {
    triggers.push('policy:context-denied')
  }

  if (input.blocked || input.contextDenied) {
    return {
      mode: 'tactic-output-capability-denied',
      effectiveRole: null,
      allowedRoles,
      triggers: sortedUnique(triggers),
      artifactHash: sha256({ input, allowedRoles, effectiveRole: null, mode: 'tactic-output-capability-denied', triggers: sortedUnique(triggers) }),
    }
  }

  if (allowedRoles.includes(input.requestedRole)) {
    return {
      mode: 'tactic-output-capability-allowed',
      effectiveRole: input.requestedRole,
      allowedRoles,
      triggers: [],
      artifactHash: sha256({ input, allowedRoles, effectiveRole: input.requestedRole, mode: 'tactic-output-capability-allowed', triggers: [] }),
    }
  }

  const requestedRank = roleRank(input.requestedRole)
  const downgradeCandidates = allowedRoles.filter((role) => roleRank(role) < requestedRank)
  const effectiveRole = downgradeCandidates.sort((a, b) => roleRank(b) - roleRank(a))[0] ?? null

  if (effectiveRole !== null) {
    const normalizedTriggers = sortedUnique(['policy:downgraded', `request:${input.requestedRole}`, `effective:${effectiveRole}`])
    return {
      mode: 'tactic-output-capability-downgraded',
      effectiveRole,
      allowedRoles,
      triggers: normalizedTriggers,
      artifactHash: sha256({ input, allowedRoles, effectiveRole, mode: 'tactic-output-capability-downgraded', triggers: normalizedTriggers }),
    }
  }

  const normalizedTriggers = sortedUnique(['policy:unsupported-role', `request:${input.requestedRole}`])
  return {
    mode: 'tactic-output-capability-denied',
    effectiveRole: null,
    allowedRoles,
    triggers: normalizedTriggers,
    artifactHash: sha256({ input, allowedRoles, effectiveRole: null, mode: 'tactic-output-capability-denied', triggers: normalizedTriggers }),
  }
}
