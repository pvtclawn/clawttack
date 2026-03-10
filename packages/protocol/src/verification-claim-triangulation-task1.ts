import { createHash } from 'node:crypto'

export type TriangulationTask1Reason = 'pass' | 'perspective-provenance-invalid' | 'operational-signal-stale'
export type PerspectiveTag = 'artifact' | 'operational'
export type EvidenceSourceType = 'test-artifact' | 'commit-artifact' | 'runtime-snapshot' | 'onchain-read' | 'route-check'

export interface TriangulationPerspectiveEvidence {
  perspectiveTag: PerspectiveTag
  sourceType: EvidenceSourceType
  observedAtUnixMs: number
  versionRef: string
}

export interface VerificationClaimTriangulationTask1Input {
  nowUnixMs: number
  operationalTtlMs: number
  perspectives: TriangulationPerspectiveEvidence[]
}

export interface VerificationClaimTriangulationTask1Result {
  verdict: 'pass' | 'fail'
  reason: TriangulationTask1Reason
  invalidPerspectiveIndexes: number[]
  staleOperationalIndexes: number[]
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

const allowedSourcesByPerspective: Record<PerspectiveTag, EvidenceSourceType[]> = {
  artifact: ['test-artifact', 'commit-artifact'],
  operational: ['runtime-snapshot', 'onchain-read', 'route-check'],
}

export const evaluateVerificationClaimTriangulationTask1 = (
  input: VerificationClaimTriangulationTask1Input,
): VerificationClaimTriangulationTask1Result => {
  const invalidPerspectiveIndexes: number[] = []
  const staleOperationalIndexes: number[] = []

  input.perspectives.forEach((perspective, index) => {
    const allowed = allowedSourcesByPerspective[perspective.perspectiveTag]
    if (!allowed.includes(perspective.sourceType)) {
      invalidPerspectiveIndexes.push(index)
      return
    }

    if (perspective.perspectiveTag === 'operational') {
      const ageMs = Math.max(0, input.nowUnixMs - perspective.observedAtUnixMs)
      if (ageMs > input.operationalTtlMs) {
        staleOperationalIndexes.push(index)
      }
    }
  })

  const basePayload = {
    nowUnixMs: input.nowUnixMs,
    operationalTtlMs: input.operationalTtlMs,
    perspectives: input.perspectives,
    invalidPerspectiveIndexes,
    staleOperationalIndexes,
  }

  if (invalidPerspectiveIndexes.length > 0) {
    return {
      verdict: 'fail',
      reason: 'perspective-provenance-invalid',
      invalidPerspectiveIndexes,
      staleOperationalIndexes,
      artifactHash: buildArtifactHash({ ...basePayload, verdict: 'fail', reason: 'perspective-provenance-invalid' }),
    }
  }

  if (staleOperationalIndexes.length > 0) {
    return {
      verdict: 'fail',
      reason: 'operational-signal-stale',
      invalidPerspectiveIndexes,
      staleOperationalIndexes,
      artifactHash: buildArtifactHash({ ...basePayload, verdict: 'fail', reason: 'operational-signal-stale' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    invalidPerspectiveIndexes,
    staleOperationalIndexes,
    artifactHash: buildArtifactHash({ ...basePayload, verdict: 'pass', reason: 'pass' }),
  }
}
