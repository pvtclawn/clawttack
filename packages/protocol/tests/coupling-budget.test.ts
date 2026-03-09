import { describe, expect, it } from 'bun:test'
import {
  computeCouplingSnapshotFingerprint,
  evaluateCouplingBudgetTask1,
  evaluateSnapshotConfidence,
  type CouplingSnapshot,
  type CouplingTask1Config,
} from '../src/coupling-budget'

const CONFIG: CouplingTask1Config = {
  requiredExtractors: ['import', 'ast'],
  minCoverageRatio: 0.8,
  minExtractorAgreement: 0.6,
  minSnapshotConfidence: 0.7,
}

const mkSnapshot = (overrides?: Partial<CouplingSnapshot>): CouplingSnapshot => ({
  snapshotSchemaVersion: 'v1',
  toolingVersion: 'tool-v1',
  edges: [
    { from: 'a.ts', to: 'b.ts', extractor: 'import' },
    { from: 'a.ts', to: 'b.ts', extractor: 'ast' },
    { from: 'b.ts', to: 'c.ts', extractor: 'import' },
    { from: 'b.ts', to: 'c.ts', extractor: 'ast' },
  ],
  extractorCoverage: {
    import: { filesSeen: 10, filesTotal: 10 },
    ast: { filesSeen: 10, filesTotal: 10 },
  },
  ...overrides,
})

describe('coupling-budget task-1', () => {
  it('produces deterministic fingerprint for identical snapshots', () => {
    const a = computeCouplingSnapshotFingerprint(mkSnapshot())
    const b = computeCouplingSnapshotFingerprint(mkSnapshot())

    expect(a).toBe(b)
  })

  it('fails closed on low coverage confidence', () => {
    const lowCoverage = mkSnapshot({
      extractorCoverage: {
        import: { filesSeen: 10, filesTotal: 10 },
        ast: { filesSeen: 1, filesTotal: 10 },
      },
    })

    const result = evaluateCouplingBudgetTask1(lowCoverage, lowCoverage, CONFIG)

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('snapshot-confidence-too-low')
    expect((result.beforeConfidence?.minCoverageRatioObserved ?? 1) < CONFIG.minCoverageRatio).toBe(
      true,
    )
  })

  it('fails closed on low extractor agreement', () => {
    const disagreement = mkSnapshot({
      edges: [
        { from: 'a.ts', to: 'b.ts', extractor: 'import' },
        { from: 'x.ts', to: 'y.ts', extractor: 'ast' },
      ],
    })

    const confidence = evaluateSnapshotConfidence(disagreement, CONFIG)
    expect(confidence.minAgreementObserved).toBeLessThan(CONFIG.minExtractorAgreement)

    const result = evaluateCouplingBudgetTask1(disagreement, disagreement, CONFIG)
    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('snapshot-confidence-too-low')
  })

  it('passes with sufficient coverage/agreement and emits fingerprints', () => {
    const before = mkSnapshot()
    const after = mkSnapshot({
      edges: [
        ...mkSnapshot().edges,
        { from: 'c.ts', to: 'd.ts', extractor: 'import' },
        { from: 'c.ts', to: 'd.ts', extractor: 'ast' },
      ],
    })

    const result = evaluateCouplingBudgetTask1(before, after, CONFIG)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('pass')
    expect(result.beforeFingerprint?.startsWith('0x')).toBe(true)
    expect(result.afterFingerprint?.startsWith('0x')).toBe(true)
  })
})
