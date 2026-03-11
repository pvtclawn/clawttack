import { createHash } from 'node:crypto'

import type { TacticHypothesisTask1Reason } from './tactic-hypothesis-task1.ts'
import type { TacticScreenTask1Reason } from './tactic-screen-task1.ts'

export type TacticEscalationTask1Outcome =
  | 'tactic-escalation-accept-cheap-path'
  | 'tactic-escalation-request-deeper-verification'
  | 'tactic-escalation-fail-closed'

export type TacticEscalationTask1DiagnosticConfidence = 'high' | 'medium' | 'low'

export interface TacticEscalationTask1Input {
  screenReason: TacticScreenTask1Reason
  hypothesisReason: TacticHypothesisTask1Reason
  contradictionScore: number
  explanationMargin: number
  alternativeDensity: number
  versionRisk: boolean
  existingDebt: number
  debtStep: number
  acceptMinimumMargin: number
  acceptMaximumAlternativeDensity: number
  acceptMaximumDebt: number
  failClosedContradictionThreshold: number
  failClosedDebtThreshold: number
  diagnosticConfidence: TacticEscalationTask1DiagnosticConfidence
}

export interface TacticEscalationTask1Trace {
  triggers: string[]
  previousDebt: number
  updatedDebt: number
  diagnosticConfidence: TacticEscalationTask1DiagnosticConfidence
}

export interface TacticEscalationTask1Result {
  outcome: TacticEscalationTask1Outcome
  trace: TacticEscalationTask1Trace
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

const sortedUnique = (items: string[]): string[] => [...new Set(items)].sort((a, b) => a.localeCompare(b))

export const evaluateTacticEscalationTask1 = (
  input: TacticEscalationTask1Input,
): TacticEscalationTask1Result => {
  const contradictionScore = clamp01(input.contradictionScore)
  const explanationMargin = clamp01(input.explanationMargin)
  const alternativeDensity = Math.max(0, input.alternativeDensity)
  const existingDebt = clamp01(input.existingDebt)
  const debtStep = clamp01(input.debtStep)

  const triggers: string[] = []

  if (input.screenReason !== 'tactic-screen-pass') {
    triggers.push(`screen:${input.screenReason}`)
  }

  if (input.hypothesisReason !== 'tactic-hypothesis-pass') {
    triggers.push(`hypothesis:${input.hypothesisReason}`)
  }

  if (explanationMargin < input.acceptMinimumMargin) {
    triggers.push('margin:below-accept-threshold')
  }

  if (alternativeDensity > input.acceptMaximumAlternativeDensity) {
    triggers.push('density:above-accept-threshold')
  }

  if (input.versionRisk) {
    triggers.push('version:risk-present')
  }

  if (contradictionScore >= input.failClosedContradictionThreshold) {
    triggers.push('contradiction:fail-closed-threshold')
  }

  if (existingDebt >= input.failClosedDebtThreshold) {
    triggers.push('debt:fail-closed-threshold')
  } else if (existingDebt > input.acceptMaximumDebt) {
    triggers.push('debt:above-accept-threshold')
  }

  if (input.diagnosticConfidence !== 'high') {
    triggers.push(`confidence:${input.diagnosticConfidence}`)
  }

  const shouldFailClosed =
    input.versionRisk ||
    contradictionScore >= input.failClosedContradictionThreshold ||
    existingDebt >= input.failClosedDebtThreshold

  const shouldEscalate =
    !shouldFailClosed &&
    (input.screenReason !== 'tactic-screen-pass' ||
      input.hypothesisReason !== 'tactic-hypothesis-pass' ||
      explanationMargin < input.acceptMinimumMargin ||
      alternativeDensity > input.acceptMaximumAlternativeDensity ||
      existingDebt > input.acceptMaximumDebt ||
      input.diagnosticConfidence !== 'high')

  const updatedDebt = shouldEscalate
    ? clamp01(existingDebt + debtStep)
    : shouldFailClosed
      ? existingDebt
      : Math.max(0, existingDebt - debtStep)

  const outcome: TacticEscalationTask1Outcome = shouldFailClosed
    ? 'tactic-escalation-fail-closed'
    : shouldEscalate
      ? 'tactic-escalation-request-deeper-verification'
      : 'tactic-escalation-accept-cheap-path'

  const trace: TacticEscalationTask1Trace = {
    triggers: sortedUnique(triggers),
    previousDebt: existingDebt,
    updatedDebt,
    diagnosticConfidence: input.diagnosticConfidence,
  }

  return {
    outcome,
    trace,
    artifactHash: sha256({
      input: {
        ...input,
        contradictionScore,
        explanationMargin,
        alternativeDensity,
        existingDebt,
        debtStep,
      },
      outcome,
      trace,
    }),
  }
}
