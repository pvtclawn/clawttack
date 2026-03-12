import { createHash } from 'node:crypto'

import type {
  TacticOutputCapabilityTask1Capability,
  TacticOutputCapabilityTask1Mode,
} from './tactic-output-capability-task1.ts'
import type { TacticOutputViewTask1Role } from './tactic-output-view-task1.ts'

export type TacticOutputCapabilityContextTask1Mode =
  | 'tactic-output-capability-context-allowed'
  | 'tactic-output-capability-context-downgraded'
  | 'tactic-output-capability-context-denied'

export type TacticOutputScopeClass = 'battle' | 'metrics' | 'operator' | 'verifier'

export interface TacticOutputCapabilityContextScope {
  scopeClass: TacticOutputScopeClass
  namespace: string
  scopeId: string
  scopeVersion: number
}

export interface TacticOutputCapabilityContextTask1Input {
  capability: TacticOutputCapabilityTask1Capability
  requestedRole: TacticOutputViewTask1Role
  blocked: boolean
  contextDenied: boolean
  boundScope: TacticOutputCapabilityContextScope
  presentedScope: TacticOutputCapabilityContextScope
  subsumptionRules: Array<{
    fromScopeClass: TacticOutputScopeClass
    toScopeClass: TacticOutputScopeClass
  }>
}

export interface TacticOutputCapabilityContextTask1Result {
  mode: TacticOutputCapabilityContextTask1Mode
  capabilityMode: TacticOutputCapabilityTask1Mode
  effectiveRole: TacticOutputViewTask1Role | null
  normalizedBoundScope: TacticOutputCapabilityContextScope
  normalizedPresentedScope: TacticOutputCapabilityContextScope
  triggers: string[]
  artifactHash: `0x${string}`
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

const normalizeToken = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

const normalizeScope = (scope: TacticOutputCapabilityContextScope): TacticOutputCapabilityContextScope => ({
  scopeClass: scope.scopeClass,
  namespace: normalizeToken(scope.namespace),
  scopeId: normalizeToken(scope.scopeId),
  scopeVersion: scope.scopeVersion,
})

const scopeEquals = (a: TacticOutputCapabilityContextScope, b: TacticOutputCapabilityContextScope): boolean => (
  a.scopeClass === b.scopeClass
  && a.namespace === b.namespace
  && a.scopeId === b.scopeId
  && a.scopeVersion === b.scopeVersion
)

const roleRank = (role: TacticOutputViewTask1Role): number => ROLE_ORDER.indexOf(role)

const sortedUnique = (items: string[]): string[] => [...new Set(items)].sort((a, b) => a.localeCompare(b))

const evaluateCapability = (
  capability: TacticOutputCapabilityTask1Capability,
  requestedRole: TacticOutputViewTask1Role,
): {
  capabilityMode: TacticOutputCapabilityTask1Mode
  effectiveRole: TacticOutputViewTask1Role | null
} => {
  const allowedRoles = CAPABILITY_LATTICE[capability]

  if (allowedRoles.includes(requestedRole)) {
    return { capabilityMode: 'tactic-output-capability-allowed', effectiveRole: requestedRole }
  }

  const requestedRank = roleRank(requestedRole)
  const downgradeCandidates = allowedRoles.filter((role) => roleRank(role) < requestedRank)
  const effectiveRole = downgradeCandidates.sort((a, b) => roleRank(b) - roleRank(a))[0] ?? null

  if (effectiveRole !== null) {
    return { capabilityMode: 'tactic-output-capability-downgraded', effectiveRole }
  }

  return { capabilityMode: 'tactic-output-capability-denied', effectiveRole: null }
}

const hasSubsumptionRule = (
  fromScopeClass: TacticOutputScopeClass,
  toScopeClass: TacticOutputScopeClass,
  rules: TacticOutputCapabilityContextTask1Input['subsumptionRules'],
): boolean => rules.some((rule) => rule.fromScopeClass === fromScopeClass && rule.toScopeClass === toScopeClass)

export const evaluateTacticOutputCapabilityContextTask1 = (
  input: TacticOutputCapabilityContextTask1Input,
): TacticOutputCapabilityContextTask1Result => {
  const normalizedBoundScope = normalizeScope(input.boundScope)
  const normalizedPresentedScope = normalizeScope(input.presentedScope)
  const triggers: string[] = []

  if (input.blocked) triggers.push('policy:blocked')
  if (input.contextDenied) triggers.push('policy:context-denied')

  if (input.blocked || input.contextDenied) {
    const mode: TacticOutputCapabilityContextTask1Mode = 'tactic-output-capability-context-denied'
    const capabilityMode: TacticOutputCapabilityTask1Mode = 'tactic-output-capability-denied'
    const normalizedTriggers = sortedUnique(triggers)
    return {
      mode,
      capabilityMode,
      effectiveRole: null,
      normalizedBoundScope,
      normalizedPresentedScope,
      triggers: normalizedTriggers,
      artifactHash: sha256({ input, normalizedBoundScope, normalizedPresentedScope, mode, capabilityMode, effectiveRole: null, triggers: normalizedTriggers }),
    }
  }

  const capabilityEvaluation = evaluateCapability(input.capability, input.requestedRole)
  if (capabilityEvaluation.capabilityMode === 'tactic-output-capability-denied') {
    const mode: TacticOutputCapabilityContextTask1Mode = 'tactic-output-capability-context-denied'
    const normalizedTriggers = sortedUnique(['policy:capability-denied'])
    return {
      mode,
      capabilityMode: capabilityEvaluation.capabilityMode,
      effectiveRole: null,
      normalizedBoundScope,
      normalizedPresentedScope,
      triggers: normalizedTriggers,
      artifactHash: sha256({ input, normalizedBoundScope, normalizedPresentedScope, mode, capabilityMode: capabilityEvaluation.capabilityMode, effectiveRole: null, triggers: normalizedTriggers }),
    }
  }

  if (scopeEquals(normalizedBoundScope, normalizedPresentedScope)) {
    const mode: TacticOutputCapabilityContextTask1Mode = capabilityEvaluation.capabilityMode === 'tactic-output-capability-allowed'
      ? 'tactic-output-capability-context-allowed'
      : 'tactic-output-capability-context-downgraded'
    return {
      mode,
      capabilityMode: capabilityEvaluation.capabilityMode,
      effectiveRole: capabilityEvaluation.effectiveRole,
      normalizedBoundScope,
      normalizedPresentedScope,
      triggers: [],
      artifactHash: sha256({ input, normalizedBoundScope, normalizedPresentedScope, mode, capabilityMode: capabilityEvaluation.capabilityMode, effectiveRole: capabilityEvaluation.effectiveRole, triggers: [] }),
    }
  }

  const sameNamespace = normalizedBoundScope.namespace === normalizedPresentedScope.namespace
  const sameVersion = normalizedBoundScope.scopeVersion === normalizedPresentedScope.scopeVersion
  const explicitSubsumption = hasSubsumptionRule(
    normalizedPresentedScope.scopeClass,
    normalizedBoundScope.scopeClass,
    input.subsumptionRules,
  )

  if (sameNamespace && sameVersion && explicitSubsumption) {
    const mode: TacticOutputCapabilityContextTask1Mode = 'tactic-output-capability-context-downgraded'
    const normalizedTriggers = sortedUnique([
      `bound:${normalizedBoundScope.scopeClass}`,
      `presented:${normalizedPresentedScope.scopeClass}`,
      'policy:context-subsumption',
    ])

    return {
      mode,
      capabilityMode: 'tactic-output-capability-downgraded',
      effectiveRole: capabilityEvaluation.effectiveRole,
      normalizedBoundScope,
      normalizedPresentedScope,
      triggers: normalizedTriggers,
      artifactHash: sha256({ input, normalizedBoundScope, normalizedPresentedScope, mode, capabilityMode: 'tactic-output-capability-downgraded', effectiveRole: capabilityEvaluation.effectiveRole, triggers: normalizedTriggers }),
    }
  }

  const mode: TacticOutputCapabilityContextTask1Mode = 'tactic-output-capability-context-denied'
  const normalizedTriggers = sortedUnique([
    `bound:${normalizedBoundScope.scopeClass}`,
    `presented:${normalizedPresentedScope.scopeClass}`,
    'policy:context-mismatch',
  ])

  return {
    mode,
    capabilityMode: capabilityEvaluation.capabilityMode,
    effectiveRole: null,
    normalizedBoundScope,
    normalizedPresentedScope,
    triggers: normalizedTriggers,
    artifactHash: sha256({ input, normalizedBoundScope, normalizedPresentedScope, mode, capabilityMode: capabilityEvaluation.capabilityMode, effectiveRole: null, triggers: normalizedTriggers }),
  }
}
