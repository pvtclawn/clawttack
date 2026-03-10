import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimResponsivenessTask1 } from '../src/verification-claim-responsiveness-task1.ts'

describe('verification claim responsiveness task1', () => {
  it('fails when short/long dual-horizon budget mismatch occurs', () => {
    const result = evaluateVerificationClaimResponsivenessTask1({
      shortWindowFailureRate: 0.06,
      longWindowFailureRate: 0.02,
      shortWindowBudget: 0.05,
      longWindowBudget: 0.03,
      stickyDebt: 1,
      stickyDebtLimit: 5,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('claim-error-budget-exceeded')
    expect(result.shortBudgetExceeded).toBe(true)
    expect(result.longBudgetExceeded).toBe(false)
  })

  it('fails when sticky debt exceeds limit (reset abuse resistant)', () => {
    const result = evaluateVerificationClaimResponsivenessTask1({
      shortWindowFailureRate: 0.01,
      longWindowFailureRate: 0.01,
      shortWindowBudget: 0.05,
      longWindowBudget: 0.03,
      stickyDebt: 6,
      stickyDebtLimit: 5,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('claim-error-budget-exceeded')
    expect(result.stickyDebtExceeded).toBe(true)
  })

  it('warns when near threshold without exceedance', () => {
    const result = evaluateVerificationClaimResponsivenessTask1({
      shortWindowFailureRate: 0.04,
      longWindowFailureRate: 0.022,
      shortWindowBudget: 0.05,
      longWindowBudget: 0.03,
      stickyDebt: 4,
      stickyDebtLimit: 5,
    })

    expect(result.verdict).toBe('warning')
    expect(result.reason).toBe('claim-responsiveness-warning')
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      shortWindowFailureRate: 0.01,
      longWindowFailureRate: 0.01,
      shortWindowBudget: 0.05,
      longWindowBudget: 0.03,
      stickyDebt: 1,
      stickyDebtLimit: 5,
    }

    const a = evaluateVerificationClaimResponsivenessTask1(input)
    const b = evaluateVerificationClaimResponsivenessTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
    expect(a.reason).toBe('claim-responsiveness-pass')
  })
})
