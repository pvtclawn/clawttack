import { describe, expect, it } from 'bun:test'
import {
  evaluateFeedbackCadenceTask1,
  type FeedbackCadenceTask1Config,
  type FeedbackCadenceWindow,
} from '../src/feedback-cadence-budget'

const CONFIG: FeedbackCadenceTask1Config = {
  maxSingleWindowRisk: 2.5,
  maxRollingWindowRisk: 4.2,
  rollingWindowSpan: 2,
  maxBurstiness: 0.2,
  warningRatio: 0.85,
}

const mkWindow = (overrides?: Partial<FeedbackCadenceWindow>): FeedbackCadenceWindow => ({
  windowId: 'w1',
  changesPerWindow: 6,
  verifyIntervalMinutes: 10,
  windowSizeMinutes: 60,
  ...overrides,
})

describe('feedback cadence budget task-1', () => {
  it('fails burst-splitting fixtures via rolling-window aggregate risk even when fixed windows pass', () => {
    const windows: FeedbackCadenceWindow[] = [
      mkWindow({ windowId: 'w1', changesPerWindow: 10, verifyIntervalMinutes: 12 }),
      mkWindow({ windowId: 'w2', changesPerWindow: 10, verifyIntervalMinutes: 12 }),
      mkWindow({ windowId: 'w3', changesPerWindow: 1, verifyIntervalMinutes: 10 }),
    ]

    const result = evaluateFeedbackCadenceTask1(windows, CONFIG)

    expect(result.fixedWindow.every((entry) => !entry.overBudget)).toBe(true)
    expect(result.rollingWindow.some((entry) => entry.overBudget)).toBe(true)
    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('cadence-budget-exceeded')
  })

  it('passes low-velocity windows without false hard fail', () => {
    const windows: FeedbackCadenceWindow[] = [
      mkWindow({ windowId: 'w1', changesPerWindow: 2, verifyIntervalMinutes: 8 }),
      mkWindow({ windowId: 'w2', changesPerWindow: 2, verifyIntervalMinutes: 8 }),
      mkWindow({ windowId: 'w3', changesPerWindow: 1, verifyIntervalMinutes: 8 }),
    ]

    const result = evaluateFeedbackCadenceTask1(windows, CONFIG)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('cadence-ok')
    expect(result.fixedWindow.length).toBe(3)
    expect(result.rollingWindow.length).toBe(2)
  })

  it('emits cadence-warning near threshold but below hard budget', () => {
    const windows: FeedbackCadenceWindow[] = [
      mkWindow({ windowId: 'w1', changesPerWindow: 9, verifyIntervalMinutes: 12 }),
      mkWindow({ windowId: 'w2', changesPerWindow: 7, verifyIntervalMinutes: 12 }),
      mkWindow({ windowId: 'w3', changesPerWindow: 1, verifyIntervalMinutes: 8 }),
    ]

    const result = evaluateFeedbackCadenceTask1(windows, CONFIG)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('cadence-warning')
  })

  it('returns deterministic verdict artifacts for identical windows', () => {
    const windows: FeedbackCadenceWindow[] = [
      mkWindow({ windowId: 'w1', changesPerWindow: 4, verifyIntervalMinutes: 10 }),
      mkWindow({ windowId: 'w2', changesPerWindow: 3, verifyIntervalMinutes: 9 }),
      mkWindow({ windowId: 'w3', changesPerWindow: 2, verifyIntervalMinutes: 8 }),
    ]

    const a = evaluateFeedbackCadenceTask1(windows, CONFIG)
    const b = evaluateFeedbackCadenceTask1(windows, CONFIG)

    expect(a).toEqual(b)
  })
})
