import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimTriangulationTask1 } from '../src/verification-claim-triangulation-task1.ts'

describe('verification claim triangulation task1', () => {
  const nowUnixMs = 1_762_600_000_000

  it('fails when perspective provenance is invalid', () => {
    const result = evaluateVerificationClaimTriangulationTask1({
      nowUnixMs,
      operationalTtlMs: 5 * 60 * 1000,
      perspectives: [
        {
          perspectiveTag: 'operational',
          sourceType: 'test-artifact',
          observedAtUnixMs: nowUnixMs - 10_000,
          versionRef: 'commit:abc123',
        },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('perspective-provenance-invalid')
    expect(result.invalidPerspectiveIndexes).toEqual([0])
  })

  it('fails when operational evidence is stale', () => {
    const result = evaluateVerificationClaimTriangulationTask1({
      nowUnixMs,
      operationalTtlMs: 5 * 60 * 1000,
      perspectives: [
        {
          perspectiveTag: 'artifact',
          sourceType: 'test-artifact',
          observedAtUnixMs: nowUnixMs - 100_000,
          versionRef: 'commit:def456',
        },
        {
          perspectiveTag: 'operational',
          sourceType: 'runtime-snapshot',
          observedAtUnixMs: nowUnixMs - 10 * 60 * 1000,
          versionRef: 'arena:122',
        },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('operational-signal-stale')
    expect(result.staleOperationalIndexes).toEqual([1])
  })

  it('passes when provenance is valid and operational evidence is fresh', () => {
    const result = evaluateVerificationClaimTriangulationTask1({
      nowUnixMs,
      operationalTtlMs: 5 * 60 * 1000,
      perspectives: [
        {
          perspectiveTag: 'artifact',
          sourceType: 'commit-artifact',
          observedAtUnixMs: nowUnixMs - 120_000,
          versionRef: 'commit:52575c2',
        },
        {
          perspectiveTag: 'operational',
          sourceType: 'onchain-read',
          observedAtUnixMs: nowUnixMs - 90_000,
          versionRef: 'battle:122',
        },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
    expect(result.invalidPerspectiveIndexes).toEqual([])
    expect(result.staleOperationalIndexes).toEqual([])
  })

  it('is deterministic for identical input', () => {
    const input = {
      nowUnixMs,
      operationalTtlMs: 5 * 60 * 1000,
      perspectives: [
        {
          perspectiveTag: 'artifact' as const,
          sourceType: 'test-artifact' as const,
          observedAtUnixMs: nowUnixMs - 60_000,
          versionRef: 'suite:v1',
        },
        {
          perspectiveTag: 'operational' as const,
          sourceType: 'route-check' as const,
          observedAtUnixMs: nowUnixMs - 30_000,
          versionRef: 'route:/battle/27',
        },
      ],
    }

    const a = evaluateVerificationClaimTriangulationTask1(input)
    const b = evaluateVerificationClaimTriangulationTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
