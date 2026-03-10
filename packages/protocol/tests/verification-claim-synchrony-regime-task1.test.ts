import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimSynchronyRegimeTask1 } from '../src/verification-claim-synchrony-regime-task1.ts'

describe('verification claim synchrony-regime task1', () => {
  const start = 1_762_560_000_000
  const end = start + 60_000

  it('fails on invalid synchrony signal authenticity', () => {
    const result = evaluateVerificationClaimSynchronyRegimeTask1({
      expectedWindowStartUnixMs: start,
      expectedWindowEndUnixMs: end,
      samples: [
        { startedAtUnixMs: start, endedAtUnixMs: end, regime: 'sync', signalAuthentic: false },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('synchrony-signal-invalid')
    expect(result.invalidSignalIndexes).toEqual([0])
  })

  it('fails when synchrony window coverage is incomplete', () => {
    const result = evaluateVerificationClaimSynchronyRegimeTask1({
      expectedWindowStartUnixMs: start,
      expectedWindowEndUnixMs: end,
      samples: [
        { startedAtUnixMs: start + 10_000, endedAtUnixMs: end, regime: 'partial-sync', signalAuthentic: true },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('synchrony-window-incomplete')
    expect(result.windowCoverageComplete).toBe(false)
  })

  it('passes when signals are authentic and window coverage is complete', () => {
    const result = evaluateVerificationClaimSynchronyRegimeTask1({
      expectedWindowStartUnixMs: start,
      expectedWindowEndUnixMs: end,
      samples: [
        { startedAtUnixMs: start, endedAtUnixMs: start + 30_000, regime: 'sync', signalAuthentic: true },
        { startedAtUnixMs: start + 30_000, endedAtUnixMs: end, regime: 'partial-sync', signalAuthentic: true },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('synchrony-regime-pass')
    expect(result.windowCoverageComplete).toBe(true)
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      expectedWindowStartUnixMs: start,
      expectedWindowEndUnixMs: end,
      samples: [
        { startedAtUnixMs: start, endedAtUnixMs: end, regime: 'sync' as const, signalAuthentic: true },
      ],
    }

    const a = evaluateVerificationClaimSynchronyRegimeTask1(input)
    const b = evaluateVerificationClaimSynchronyRegimeTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
