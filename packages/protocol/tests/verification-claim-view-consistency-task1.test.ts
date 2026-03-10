import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimViewConsistencyTask1 } from '../src/verification-claim-view-consistency-task1.ts'

describe('verification claim view-consistency task1', () => {
  const nowUnixMs = 1_762_620_000_000
  const maxAgeByViewMs = {
    local: 30 * 60 * 1000,
    holon: 20 * 60 * 1000,
    global: 10 * 60 * 1000,
  } as const

  it('fails when view-tag provenance is invalid', () => {
    const result = evaluateVerificationClaimViewConsistencyTask1({
      nowUnixMs,
      maxAgeByViewMs,
      evidence: [
        { id: 'e1', view: 'local', provenanceVerified: true, observedAtUnixMs: nowUnixMs - 60_000 },
        { id: 'e2', view: 'global', provenanceVerified: false, observedAtUnixMs: nowUnixMs - 60_000 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('view-tag-provenance-invalid')
    expect(result.invalidProvenanceIds).toEqual(['e2'])
  })

  it('fails when high-view evidence is stale', () => {
    const result = evaluateVerificationClaimViewConsistencyTask1({
      nowUnixMs,
      maxAgeByViewMs,
      evidence: [
        { id: 'e1', view: 'local', provenanceVerified: true, observedAtUnixMs: nowUnixMs - 60_000 },
        { id: 'e2', view: 'global', provenanceVerified: true, observedAtUnixMs: nowUnixMs - 20 * 60 * 1000 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('view-evidence-stale')
    expect(result.staleEvidenceIds).toEqual(['e2'])
  })

  it('passes when evidence provenance is valid and freshness bounds are met', () => {
    const result = evaluateVerificationClaimViewConsistencyTask1({
      nowUnixMs,
      maxAgeByViewMs,
      evidence: [
        { id: 'e1', view: 'local', provenanceVerified: true, observedAtUnixMs: nowUnixMs - 60_000 },
        { id: 'e2', view: 'holon', provenanceVerified: true, observedAtUnixMs: nowUnixMs - 2 * 60 * 1000 },
        { id: 'e3', view: 'global', provenanceVerified: true, observedAtUnixMs: nowUnixMs - 3 * 60 * 1000 },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('view-consistency-pass')
    expect(result.invalidProvenanceIds).toEqual([])
    expect(result.staleEvidenceIds).toEqual([])
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      nowUnixMs,
      maxAgeByViewMs,
      evidence: [
        { id: 'e1', view: 'local' as const, provenanceVerified: true, observedAtUnixMs: nowUnixMs - 60_000 },
        { id: 'e2', view: 'global' as const, provenanceVerified: true, observedAtUnixMs: nowUnixMs - 120_000 },
      ],
    }

    const a = evaluateVerificationClaimViewConsistencyTask1(input)
    const b = evaluateVerificationClaimViewConsistencyTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
