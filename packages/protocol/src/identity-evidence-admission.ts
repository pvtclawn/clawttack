import { createHash } from 'node:crypto'

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

export interface IdentityEvidenceRecord {
  issuerId: string
  issuerClusterId: string
  issuerReputation: number
  evidenceStrength: number
  evidenceAgeBlocks: number
}

export interface IdentityEvidenceEnvelope {
  identityRef: string
  identityContinuityBlocks: number
  evidence: IdentityEvidenceRecord[]
}

export interface IdentityEvidenceTask1Config {
  minIssuerDiversity: number
  minIdentityContinuityBlocks: number
  maxIssuerClusterConcentration: number
  maxEvidenceAgeBlocks: number
  minWeightedQuality: number
}

export type IdentityEvidenceTask1Reason =
  | 'pass'
  | 'schema-invalid'
  | 'identity-missing'
  | 'identity-continuity-insufficient'
  | 'issuer-diversity-insufficient'
  | 'issuer-collusion-concentration-too-high'
  | 'evidence-quality-insufficient'

export interface IdentityEvidenceTask1Metrics {
  issuerCount: number
  issuerDiversity: number
  maxClusterConcentration: number
  weightedQuality: number
  freshEvidenceRatio: number
  identityContinuityBlocks: number
  admissionScore: number
}

export interface IdentityEvidenceTask1Result {
  verdict: 'pass' | 'fail'
  reason: IdentityEvidenceTask1Reason
  metrics: IdentityEvidenceTask1Metrics
  artifactHash: `0x${string}`
}

const validateConfig = (config: IdentityEvidenceTask1Config): void => {
  if (!Number.isFinite(config.minIssuerDiversity) || config.minIssuerDiversity <= 0 || config.minIssuerDiversity > 1) {
    throw new Error('invalid-min-issuer-diversity')
  }
  if (!Number.isFinite(config.minIdentityContinuityBlocks) || config.minIdentityContinuityBlocks < 0) {
    throw new Error('invalid-min-identity-continuity-blocks')
  }
  if (!Number.isFinite(config.maxIssuerClusterConcentration) || config.maxIssuerClusterConcentration <= 0 || config.maxIssuerClusterConcentration > 1) {
    throw new Error('invalid-max-cluster-concentration')
  }
  if (!Number.isFinite(config.maxEvidenceAgeBlocks) || config.maxEvidenceAgeBlocks < 0) {
    throw new Error('invalid-max-evidence-age-blocks')
  }
  if (!Number.isFinite(config.minWeightedQuality) || config.minWeightedQuality <= 0 || config.minWeightedQuality > 1) {
    throw new Error('invalid-min-weighted-quality')
  }
}

const isValidRecord = (record: IdentityEvidenceRecord): boolean => {
  if (!record.issuerId || record.issuerId.trim().length === 0) return false
  if (!record.issuerClusterId || record.issuerClusterId.trim().length === 0) return false
  if (!Number.isFinite(record.issuerReputation) || record.issuerReputation < 0) return false
  if (!Number.isFinite(record.evidenceStrength) || record.evidenceStrength < 0) return false
  if (!Number.isFinite(record.evidenceAgeBlocks) || record.evidenceAgeBlocks < 0) return false
  return true
}

const emptyMetrics = (identityContinuityBlocks = 0): IdentityEvidenceTask1Metrics => ({
  issuerCount: 0,
  issuerDiversity: 0,
  maxClusterConcentration: 1,
  weightedQuality: 0,
  freshEvidenceRatio: 0,
  identityContinuityBlocks,
  admissionScore: 0,
})

const toArtifactHash = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const computeMetrics = (
  envelope: IdentityEvidenceEnvelope,
  config: IdentityEvidenceTask1Config,
): IdentityEvidenceTask1Metrics => {
  const issuerSet = new Set(envelope.evidence.map((record) => record.issuerId))
  const issuerCount = issuerSet.size
  const evidenceCount = envelope.evidence.length

  const issuerDiversity = evidenceCount === 0 ? 0 : clamp01(issuerCount / evidenceCount)

  const clusterCounts = new Map<string, number>()
  for (const record of envelope.evidence) {
    clusterCounts.set(record.issuerClusterId, (clusterCounts.get(record.issuerClusterId) ?? 0) + 1)
  }
  const maxClusterCount =
    evidenceCount === 0 ? 0 : Math.max(...Array.from(clusterCounts.values()))
  const maxClusterConcentration =
    evidenceCount === 0 ? 1 : clamp01(maxClusterCount / evidenceCount)

  const weightedQualityNumerator = envelope.evidence.reduce((sum, record) => {
    return sum + clamp01(record.issuerReputation) * clamp01(record.evidenceStrength)
  }, 0)
  const weightedQuality =
    evidenceCount === 0 ? 0 : clamp01(weightedQualityNumerator / evidenceCount)

  const freshEvidenceCount = envelope.evidence.filter(
    (record) => record.evidenceAgeBlocks <= config.maxEvidenceAgeBlocks,
  ).length
  const freshEvidenceRatio =
    evidenceCount === 0 ? 0 : clamp01(freshEvidenceCount / evidenceCount)

  const continuityScore =
    config.minIdentityContinuityBlocks <= 0
      ? 1
      : clamp01(envelope.identityContinuityBlocks / config.minIdentityContinuityBlocks)

  const admissionScore = clamp01(
    issuerDiversity * 0.35 +
      weightedQuality * 0.35 +
      (1 - maxClusterConcentration) * 0.2 +
      continuityScore * 0.1,
  )

  return {
    issuerCount,
    issuerDiversity,
    maxClusterConcentration,
    weightedQuality,
    freshEvidenceRatio,
    identityContinuityBlocks: envelope.identityContinuityBlocks,
    admissionScore,
  }
}

/**
 * Task-1 identity-evidence gate (simulation-only):
 * - deterministic anti-sybil / anti-collusion metrics,
 * - deterministic reason precedence,
 * - artifact hash for replay/verification trails.
 */
export const evaluateIdentityEvidenceTask1 = (
  envelope: IdentityEvidenceEnvelope,
  config: IdentityEvidenceTask1Config,
): IdentityEvidenceTask1Result => {
  validateConfig(config)

  const identityContinuityBlocks = Number.isFinite(envelope?.identityContinuityBlocks)
    ? envelope.identityContinuityBlocks
    : 0

  if (!envelope || typeof envelope !== 'object' || !Array.isArray(envelope.evidence)) {
    const metrics = emptyMetrics(identityContinuityBlocks)
    return {
      verdict: 'fail',
      reason: 'schema-invalid',
      metrics,
      artifactHash: toArtifactHash({ config, envelope, verdict: 'fail', reason: 'schema-invalid', metrics }),
    }
  }

  if (!envelope.identityRef || envelope.identityRef.trim().length === 0) {
    const metrics = emptyMetrics(identityContinuityBlocks)
    return {
      verdict: 'fail',
      reason: 'identity-missing',
      metrics,
      artifactHash: toArtifactHash({ config, envelope, verdict: 'fail', reason: 'identity-missing', metrics }),
    }
  }

  if (!Number.isFinite(envelope.identityContinuityBlocks) || envelope.identityContinuityBlocks < 0) {
    const metrics = emptyMetrics(identityContinuityBlocks)
    return {
      verdict: 'fail',
      reason: 'schema-invalid',
      metrics,
      artifactHash: toArtifactHash({ config, envelope, verdict: 'fail', reason: 'schema-invalid', metrics }),
    }
  }

  if (envelope.evidence.some((record) => !isValidRecord(record))) {
    const metrics = emptyMetrics(identityContinuityBlocks)
    return {
      verdict: 'fail',
      reason: 'schema-invalid',
      metrics,
      artifactHash: toArtifactHash({ config, envelope, verdict: 'fail', reason: 'schema-invalid', metrics }),
    }
  }

  const metrics = computeMetrics(envelope, config)

  let reason: IdentityEvidenceTask1Reason = 'pass'
  let verdict: 'pass' | 'fail' = 'pass'

  if (metrics.identityContinuityBlocks < config.minIdentityContinuityBlocks) {
    reason = 'identity-continuity-insufficient'
    verdict = 'fail'
  } else if (metrics.issuerDiversity < config.minIssuerDiversity) {
    reason = 'issuer-diversity-insufficient'
    verdict = 'fail'
  } else if (metrics.maxClusterConcentration > config.maxIssuerClusterConcentration) {
    reason = 'issuer-collusion-concentration-too-high'
    verdict = 'fail'
  } else if (
    metrics.weightedQuality < config.minWeightedQuality ||
    metrics.freshEvidenceRatio < config.minWeightedQuality
  ) {
    reason = 'evidence-quality-insufficient'
    verdict = 'fail'
  }

  return {
    verdict,
    reason,
    metrics,
    artifactHash: toArtifactHash({ config, envelope, verdict, reason, metrics }),
  }
}
