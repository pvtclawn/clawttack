import { createHash } from 'node:crypto'

import type { TacticEvidenceTask1Family } from './tactic-evidence-task1.ts'

export type TacticScreenTask1Reason =
  | 'tactic-screen-pass'
  | 'tactic-screen-feature-theater-risk'
  | 'tactic-screen-objective-effect-missing'

export type TacticScreenTask1Provenance =
  | 'runtime-behavior'
  | 'derived-structural'
  | 'lexical-cue'

export interface TacticScreenTask1Feature {
  featureId: string
  family: TacticEvidenceTask1Family
  confidence: number
  provenance: TacticScreenTask1Provenance
}

export interface TacticScreenTask1Input {
  declaredFamily: TacticEvidenceTask1Family
  objectiveWitness: string
  effectWitness: string
  minimumStrongSupport: number
  maximumLexicalShare: number
  features: TacticScreenTask1Feature[]
}

export interface TacticScreenTask1Result {
  verdict: 'pass' | 'fail'
  reason: TacticScreenTask1Reason
  inferredFamily: TacticEvidenceTask1Family | null
  weightedFamilySupport: Record<TacticEvidenceTask1Family, number>
  strongFamilySupport: Record<TacticEvidenceTask1Family, number>
  lexicalFamilySupport: Record<TacticEvidenceTask1Family, number>
  artifactHash: `0x${string}`
}

const TACTIC_FAMILIES: readonly TacticEvidenceTask1Family[] = [
  'prompt-injection',
  'ctf-lure',
  'dos-noise',
  'social-engineering',
  'joker',
  'other',
] as const

const PROVENANCE_WEIGHT: Record<TacticScreenTask1Provenance, number> = {
  'runtime-behavior': 1,
  'derived-structural': 0.8,
  'lexical-cue': 0.2,
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

const sha256 = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const normalizeText = (value: string): string => value.trim()

const normalizeFeatureId = (value: string): string => value.trim().toLowerCase()

const createEmptySupport = (): Record<TacticEvidenceTask1Family, number> => ({
  'prompt-injection': 0,
  'ctf-lure': 0,
  'dos-noise': 0,
  'social-engineering': 0,
  joker: 0,
  other: 0,
})

export const evaluateTacticScreenTask1 = (input: TacticScreenTask1Input): TacticScreenTask1Result => {
  const objectiveWitness = normalizeText(input.objectiveWitness)
  const effectWitness = normalizeText(input.effectWitness)

  const normalizedFeatures = input.features
    .map((feature) => ({
      featureId: normalizeFeatureId(feature.featureId),
      family: feature.family,
      confidence: clamp01(feature.confidence),
      provenance: feature.provenance,
    }))
    .sort((a, b) => a.featureId.localeCompare(b.featureId) || a.family.localeCompare(b.family))

  const weightedFamilySupport = createEmptySupport()
  const strongFamilySupport = createEmptySupport()
  const lexicalFamilySupport = createEmptySupport()

  for (const feature of normalizedFeatures) {
    const weightedConfidence = feature.confidence * PROVENANCE_WEIGHT[feature.provenance]
    weightedFamilySupport[feature.family] += weightedConfidence
    if (feature.provenance === 'lexical-cue') {
      lexicalFamilySupport[feature.family] += weightedConfidence
    } else {
      strongFamilySupport[feature.family] += weightedConfidence
    }
  }

  const rankedFamilies = [...TACTIC_FAMILIES]
    .map((family) => ({ family, support: weightedFamilySupport[family] }))
    .sort((a, b) => b.support - a.support || a.family.localeCompare(b.family))

  const inferredFamily = rankedFamilies[0]?.support ? rankedFamilies[0].family : null
  const inferredWeightedSupport = inferredFamily ? weightedFamilySupport[inferredFamily] : 0
  const inferredStrongSupport = inferredFamily ? strongFamilySupport[inferredFamily] : 0
  const inferredLexicalSupport = inferredFamily ? lexicalFamilySupport[inferredFamily] : 0
  const lexicalShare = inferredWeightedSupport > 0 ? inferredLexicalSupport / inferredWeightedSupport : 1

  const payload = {
    declaredFamily: input.declaredFamily,
    objectiveWitness,
    effectWitness,
    minimumStrongSupport: input.minimumStrongSupport,
    maximumLexicalShare: input.maximumLexicalShare,
    features: normalizedFeatures,
    inferredFamily,
    weightedFamilySupport,
    strongFamilySupport,
    lexicalFamilySupport,
  }

  if (objectiveWitness.length === 0 || effectWitness.length === 0) {
    return {
      verdict: 'fail',
      reason: 'tactic-screen-objective-effect-missing',
      inferredFamily,
      weightedFamilySupport,
      strongFamilySupport,
      lexicalFamilySupport,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'tactic-screen-objective-effect-missing' }),
    }
  }

  if (
    inferredFamily === null ||
    inferredFamily !== input.declaredFamily ||
    inferredStrongSupport < input.minimumStrongSupport ||
    lexicalShare > input.maximumLexicalShare
  ) {
    return {
      verdict: 'fail',
      reason: 'tactic-screen-feature-theater-risk',
      inferredFamily,
      weightedFamilySupport,
      strongFamilySupport,
      lexicalFamilySupport,
      artifactHash: sha256({
        ...payload,
        lexicalShare,
        verdict: 'fail',
        reason: 'tactic-screen-feature-theater-risk',
      }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'tactic-screen-pass',
    inferredFamily,
    weightedFamilySupport,
    strongFamilySupport,
    lexicalFamilySupport,
    artifactHash: sha256({ ...payload, lexicalShare, verdict: 'pass', reason: 'tactic-screen-pass' }),
  }
}
