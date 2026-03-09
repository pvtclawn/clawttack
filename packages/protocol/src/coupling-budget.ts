import { createHash } from 'node:crypto'

export interface CouplingEdge {
  from: string
  to: string
  extractor: string
}

export interface ExtractorCoverage {
  filesSeen: number
  filesTotal: number
}

export interface CouplingSnapshot {
  snapshotSchemaVersion: string
  toolingVersion: string
  edges: CouplingEdge[]
  extractorCoverage: Record<string, ExtractorCoverage>
}

export interface CouplingTask1Config {
  requiredExtractors: string[]
  minCoverageRatio: number
  minExtractorAgreement: number
  minSnapshotConfidence: number
}

export type CouplingTask1Reason =
  | 'pass'
  | 'snapshot-confidence-too-low'
  | 'snapshot-data-incomplete'

export interface SnapshotConfidence {
  confidence: number
  minCoverageRatioObserved: number
  minAgreementObserved: number
  missingExtractors: string[]
  coverageByExtractor: Record<string, number>
}

export interface CouplingTask1Result {
  verdict: 'pass' | 'fail'
  reason: CouplingTask1Reason
  beforeFingerprint?: `0x${string}`
  afterFingerprint?: `0x${string}`
  beforeConfidence?: SnapshotConfidence
  afterConfidence?: SnapshotConfidence
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

const normalizedEdgeKey = (edge: CouplingEdge): string => `${edge.from}=>${edge.to}`

const validateSnapshot = (snapshot: CouplingSnapshot): boolean => {
  if (!snapshot.snapshotSchemaVersion || !snapshot.toolingVersion) return false
  if (!Array.isArray(snapshot.edges)) return false
  if (!snapshot.extractorCoverage || typeof snapshot.extractorCoverage !== 'object') return false
  return true
}

export const computeCouplingSnapshotFingerprint = (
  snapshot: CouplingSnapshot,
): `0x${string}` => {
  const normalized = {
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    toolingVersion: snapshot.toolingVersion,
    edges: [...snapshot.edges]
      .map((edge) => ({
        from: edge.from,
        to: edge.to,
        extractor: edge.extractor,
      }))
      .sort((a, b) =>
        `${a.from}|${a.to}|${a.extractor}`.localeCompare(`${b.from}|${b.to}|${b.extractor}`),
      ),
    extractorCoverage: Object.fromEntries(
      Object.entries(snapshot.extractorCoverage)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => [
          name,
          {
            filesSeen: value.filesSeen,
            filesTotal: value.filesTotal,
          },
        ]),
    ),
  }

  const digest = createHash('sha256').update(stableStringify(normalized)).digest('hex')
  return `0x${digest}`
}

const extractorEdgeSet = (
  snapshot: CouplingSnapshot,
  extractor: string,
): Set<string> => {
  return new Set(
    snapshot.edges
      .filter((edge) => edge.extractor === extractor)
      .map((edge) => normalizedEdgeKey(edge)),
  )
}

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 1
  const union = new Set([...a, ...b])
  let intersectionCount = 0
  for (const v of a) {
    if (b.has(v)) intersectionCount += 1
  }
  return union.size === 0 ? 0 : intersectionCount / union.size
}

export const evaluateSnapshotConfidence = (
  snapshot: CouplingSnapshot,
  config: CouplingTask1Config,
): SnapshotConfidence => {
  const requiredExtractors = [...config.requiredExtractors]
  const missingExtractors = requiredExtractors.filter(
    (name) => snapshot.extractorCoverage[name] == null,
  )

  const coverageByExtractor: Record<string, number> = {}
  for (const extractor of requiredExtractors) {
    const coverage = snapshot.extractorCoverage[extractor]
    if (!coverage) {
      coverageByExtractor[extractor] = 0
      continue
    }
    if (!Number.isFinite(coverage.filesTotal) || coverage.filesTotal <= 0) {
      coverageByExtractor[extractor] = 0
      continue
    }
    coverageByExtractor[extractor] = clamp01(coverage.filesSeen / coverage.filesTotal)
  }

  const minCoverageRatioObserved =
    Object.values(coverageByExtractor).length > 0
      ? Math.min(...Object.values(coverageByExtractor))
      : 0

  const requiredPairs: Array<[string, string]> = []
  for (let i = 0; i < requiredExtractors.length; i += 1) {
    const left = requiredExtractors[i]
    if (!left) continue

    for (let j = i + 1; j < requiredExtractors.length; j += 1) {
      const right = requiredExtractors[j]
      if (!right) continue
      requiredPairs.push([left, right])
    }
  }

  const agreements = requiredPairs.map(([a, b]) =>
    jaccard(extractorEdgeSet(snapshot, a), extractorEdgeSet(snapshot, b)),
  )

  const minAgreementObserved = agreements.length > 0 ? Math.min(...agreements) : 1

  const coverageScore = minCoverageRatioObserved
  const agreementScore = minAgreementObserved
  const missingPenalty = missingExtractors.length > 0 ? 0.5 : 1

  const confidence = clamp01(Math.min(coverageScore, agreementScore) * missingPenalty)

  return {
    confidence,
    minCoverageRatioObserved,
    minAgreementObserved,
    missingExtractors,
    coverageByExtractor,
  }
}

/**
 * Task-1 coupling budget gate: fail closed on low-confidence snapshots.
 */
export const evaluateCouplingBudgetTask1 = (
  before: CouplingSnapshot,
  after: CouplingSnapshot,
  config: CouplingTask1Config,
): CouplingTask1Result => {
  if (!validateSnapshot(before) || !validateSnapshot(after)) {
    return {
      verdict: 'fail',
      reason: 'snapshot-data-incomplete',
    }
  }

  const beforeConfidence = evaluateSnapshotConfidence(before, config)
  const afterConfidence = evaluateSnapshotConfidence(after, config)

  const minCoverageOk =
    beforeConfidence.minCoverageRatioObserved >= config.minCoverageRatio &&
    afterConfidence.minCoverageRatioObserved >= config.minCoverageRatio

  const minAgreementOk =
    beforeConfidence.minAgreementObserved >= config.minExtractorAgreement &&
    afterConfidence.minAgreementObserved >= config.minExtractorAgreement

  const confidenceOk =
    beforeConfidence.confidence >= config.minSnapshotConfidence &&
    afterConfidence.confidence >= config.minSnapshotConfidence

  if (!minCoverageOk || !minAgreementOk || !confidenceOk) {
    return {
      verdict: 'fail',
      reason: 'snapshot-confidence-too-low',
      beforeFingerprint: computeCouplingSnapshotFingerprint(before),
      afterFingerprint: computeCouplingSnapshotFingerprint(after),
      beforeConfidence,
      afterConfidence,
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    beforeFingerprint: computeCouplingSnapshotFingerprint(before),
    afterFingerprint: computeCouplingSnapshotFingerprint(after),
    beforeConfidence,
    afterConfidence,
  }
}
