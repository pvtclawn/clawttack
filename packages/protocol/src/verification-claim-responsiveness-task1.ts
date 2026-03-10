import { createHash } from 'node:crypto'

export type VerificationClaimResponsivenessTask1Reason =
  | 'claim-responsiveness-pass'
  | 'claim-responsiveness-warning'
  | 'claim-error-budget-exceeded'

export interface VerificationClaimResponsivenessTask1Input {
  shortWindowFailureRate: number
  longWindowFailureRate: number
  shortWindowBudget: number
  longWindowBudget: number
  stickyDebt: number
  stickyDebtLimit: number
}

export interface VerificationClaimResponsivenessTask1Result {
  verdict: 'pass' | 'warning' | 'fail'
  reason: VerificationClaimResponsivenessTask1Reason
  shortBudgetExceeded: boolean
  longBudgetExceeded: boolean
  stickyDebtExceeded: boolean
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

const buildArtifactHash = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

export const evaluateVerificationClaimResponsivenessTask1 = (
  input: VerificationClaimResponsivenessTask1Input,
): VerificationClaimResponsivenessTask1Result => {
  const shortBudgetExceeded = input.shortWindowFailureRate > input.shortWindowBudget
  const longBudgetExceeded = input.longWindowFailureRate > input.longWindowBudget
  const stickyDebtExceeded = input.stickyDebt > input.stickyDebtLimit

  const payload = {
    shortWindowFailureRate: input.shortWindowFailureRate,
    longWindowFailureRate: input.longWindowFailureRate,
    shortWindowBudget: input.shortWindowBudget,
    longWindowBudget: input.longWindowBudget,
    stickyDebt: input.stickyDebt,
    stickyDebtLimit: input.stickyDebtLimit,
    shortBudgetExceeded,
    longBudgetExceeded,
    stickyDebtExceeded,
  }

  if (shortBudgetExceeded || longBudgetExceeded || stickyDebtExceeded) {
    return {
      verdict: 'fail',
      reason: 'claim-error-budget-exceeded',
      shortBudgetExceeded,
      longBudgetExceeded,
      stickyDebtExceeded,
      artifactHash: buildArtifactHash({ ...payload, verdict: 'fail', reason: 'claim-error-budget-exceeded' }),
    }
  }

  const shortWarning = input.shortWindowFailureRate >= input.shortWindowBudget * 0.8
  const longWarning = input.longWindowFailureRate >= input.longWindowBudget * 0.8
  const stickyDebtWarning = input.stickyDebt >= input.stickyDebtLimit * 0.8

  if (shortWarning || longWarning || stickyDebtWarning) {
    return {
      verdict: 'warning',
      reason: 'claim-responsiveness-warning',
      shortBudgetExceeded,
      longBudgetExceeded,
      stickyDebtExceeded,
      artifactHash: buildArtifactHash({ ...payload, verdict: 'warning', reason: 'claim-responsiveness-warning' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'claim-responsiveness-pass',
    shortBudgetExceeded,
    longBudgetExceeded,
    stickyDebtExceeded,
    artifactHash: buildArtifactHash({ ...payload, verdict: 'pass', reason: 'claim-responsiveness-pass' }),
  }
}
