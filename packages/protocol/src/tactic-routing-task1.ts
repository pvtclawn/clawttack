import { createHash } from 'node:crypto'

import type { TacticEscalationTask1Outcome } from './tactic-escalation-task1.ts'

export type TacticRoutingTask1Outcome =
  | 'tactic-routing-primary-path'
  | 'tactic-routing-backup-path'
  | 'tactic-routing-budget-exhausted'
  | 'tactic-routing-fail-closed'

export interface TacticRoutingTask1Input {
  escalationOutcome: TacticEscalationTask1Outcome
  contradictionScore: number
  versionRisk: boolean
  actorBudget: number
  contextBudget: number
  requiredBackupBudget: number
  existingDebt: number
  failClosedContradictionThreshold: number
}

export interface TacticRoutingTask1Trace {
  triggers: string[]
  actorBudgetBefore: number
  actorBudgetAfter: number
  contextBudgetBefore: number
  contextBudgetAfter: number
  requiredBackupBudget: number
  existingDebt: number
}

export interface TacticRoutingTask1Result {
  outcome: TacticRoutingTask1Outcome
  trace: TacticRoutingTask1Trace
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

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const clampBudget = (value: number): number => Math.max(0, value)
const sortedUnique = (items: string[]): string[] => [...new Set(items)].sort((a, b) => a.localeCompare(b))

export const evaluateTacticRoutingTask1 = (
  input: TacticRoutingTask1Input,
): TacticRoutingTask1Result => {
  const contradictionScore = clamp01(input.contradictionScore)
  const actorBudgetBefore = clampBudget(input.actorBudget)
  const contextBudgetBefore = clampBudget(input.contextBudget)
  const requiredBackupBudget = clampBudget(input.requiredBackupBudget)
  const existingDebt = clamp01(input.existingDebt)

  const triggers: string[] = []

  if (input.escalationOutcome === 'tactic-escalation-fail-closed') {
    triggers.push('escalation:fail-closed')
  } else if (input.escalationOutcome === 'tactic-escalation-request-deeper-verification') {
    triggers.push('escalation:request-deeper-verification')
  }

  if (input.versionRisk) {
    triggers.push('version:risk-present')
  }

  if (contradictionScore >= input.failClosedContradictionThreshold) {
    triggers.push('contradiction:fail-closed-threshold')
  }

  const actorBudgetInsufficient = actorBudgetBefore < requiredBackupBudget
  const contextBudgetInsufficient = contextBudgetBefore < requiredBackupBudget

  if (actorBudgetInsufficient) {
    triggers.push('budget:actor-insufficient')
  }

  if (contextBudgetInsufficient) {
    triggers.push('budget:context-insufficient')
  }

  const shouldFailClosed =
    input.escalationOutcome === 'tactic-escalation-fail-closed' ||
    input.versionRisk ||
    contradictionScore >= input.failClosedContradictionThreshold

  const shouldRouteBackup =
    !shouldFailClosed &&
    input.escalationOutcome === 'tactic-escalation-request-deeper-verification' &&
    !actorBudgetInsufficient &&
    !contextBudgetInsufficient

  const shouldBudgetExhaust =
    !shouldFailClosed &&
    input.escalationOutcome === 'tactic-escalation-request-deeper-verification' &&
    !shouldRouteBackup

  const outcome: TacticRoutingTask1Outcome = shouldFailClosed
    ? 'tactic-routing-fail-closed'
    : shouldRouteBackup
      ? 'tactic-routing-backup-path'
      : shouldBudgetExhaust
        ? 'tactic-routing-budget-exhausted'
        : 'tactic-routing-primary-path'

  const actorBudgetAfter = shouldRouteBackup
    ? clampBudget(actorBudgetBefore - requiredBackupBudget)
    : actorBudgetBefore
  const contextBudgetAfter = shouldRouteBackup
    ? clampBudget(contextBudgetBefore - requiredBackupBudget)
    : contextBudgetBefore

  const trace: TacticRoutingTask1Trace = {
    triggers: sortedUnique(triggers),
    actorBudgetBefore,
    actorBudgetAfter,
    contextBudgetBefore,
    contextBudgetAfter,
    requiredBackupBudget,
    existingDebt,
  }

  return {
    outcome,
    trace,
    artifactHash: sha256({
      input: {
        ...input,
        contradictionScore,
        actorBudget: actorBudgetBefore,
        contextBudget: contextBudgetBefore,
        requiredBackupBudget,
        existingDebt,
      },
      outcome,
      trace,
    }),
  }
}
