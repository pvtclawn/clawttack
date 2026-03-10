import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimTraceTask1 } from '../src/verification-claim-trace-task1.ts'

describe('verification claim trace task1', () => {
  const nowUnixMs = 1_762_602_000_000

  it('fails when step provenance mismatches canonical claim/input binding', () => {
    const result = evaluateVerificationClaimTraceTask1({
      envelopeCreatedAtUnixMs: nowUnixMs - 60_000,
      nowUnixMs,
      freshnessTtlMs: 300_000,
      canonicalClaimId: 'claim-122',
      canonicalInputRoot: '0xaaa111',
      steps: [
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'ingest', stepIndex: 0 },
        { claimId: 'claim-999', inputRoot: '0xaaa111', phase: 'caveat', stepIndex: 1 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('step-provenance-invalid')
    expect(result.invalidStepIndexes).toEqual([1])
  })

  it('fails when trace envelope is stale and treated as replay', () => {
    const result = evaluateVerificationClaimTraceTask1({
      envelopeCreatedAtUnixMs: nowUnixMs - 10 * 60 * 1000,
      nowUnixMs,
      freshnessTtlMs: 5 * 60 * 1000,
      canonicalClaimId: 'claim-122',
      canonicalInputRoot: '0xaaa111',
      steps: [
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'ingest', stepIndex: 0 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('trace-replay-detected')
    expect(result.replayDetected).toBe(true)
  })

  it('passes with valid provenance and fresh trace envelope', () => {
    const result = evaluateVerificationClaimTraceTask1({
      envelopeCreatedAtUnixMs: nowUnixMs - 60_000,
      nowUnixMs,
      freshnessTtlMs: 5 * 60 * 1000,
      canonicalClaimId: 'claim-122',
      canonicalInputRoot: '0xaaa111',
      steps: [
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'ingest', stepIndex: 0 },
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'caveat', stepIndex: 1 },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
    expect(result.invalidStepIndexes).toEqual([])
    expect(result.replayDetected).toBe(false)
  })

  it('is deterministic for identical input tuple', () => {
    const input = {
      envelopeCreatedAtUnixMs: nowUnixMs - 30_000,
      nowUnixMs,
      freshnessTtlMs: 5 * 60 * 1000,
      canonicalClaimId: 'claim-122',
      canonicalInputRoot: '0xaaa111',
      steps: [
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'ingest', stepIndex: 0 },
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'caveat', stepIndex: 1 },
        { claimId: 'claim-122', inputRoot: '0xaaa111', phase: 'triangulation', stepIndex: 2 },
      ],
    }

    const a = evaluateVerificationClaimTraceTask1(input)
    const b = evaluateVerificationClaimTraceTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
