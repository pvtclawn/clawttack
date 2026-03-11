import { createHash } from 'node:crypto'

import type { TacticEvidenceTask1Family } from './tactic-evidence-task1.ts'

export type TacticHypothesisTask1Reason =
  | 'tactic-hypothesis-pass'
  | 'tactic-hypothesis-ambiguous'
  | 'tactic-hypothesis-contradicted'

export interface TacticHypothesisTask1Candidate {
  family: TacticEvidenceTask1Family
  support: number
  contradiction: number
}

export interface TacticHypothesisTask1Input {
  candidates: TacticHypothesisTask1Candidate[]
  contradictionThreshold: number
  minimumMargin: number
  maximumAlternativeDensity: number
}

export interface TacticHypothesisTask1RankedCandidate {
  family: TacticEvidenceTask1Family
  support: number
  contradiction: number
  netScore: number
}

export interface TacticHypothesisTask1Result {
  verdict: 'pass' | 'fail'
  reason: TacticHypothesisTask1Reason
  inferredFamily: TacticEvidenceTask1Family | null
  topMargin: number
  alternativeDensity: number
  rankedCandidates: TacticHypothesisTask1RankedCandidate[]
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

const sha256 = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export const evaluateTacticHypothesisTask1 = (
  input: TacticHypothesisTask1Input,
): TacticHypothesisTask1Result => {
  const rankedCandidates = input.candidates
    .map((candidate) => ({
      family: candidate.family,
      support: clamp01(candidate.support),
      contradiction: clamp01(candidate.contradiction),
      netScore: clamp01(candidate.support) - clamp01(candidate.contradiction),
    }))
    .sort(
      (a, b) =>
        b.netScore - a.netScore ||
        b.support - a.support ||
        a.family.localeCompare(b.family),
    )

  const topCandidate = rankedCandidates[0] ?? null
  const nextCandidate = rankedCandidates[1] ?? null
  const inferredFamily = topCandidate?.family ?? null
  const topMargin = topCandidate ? topCandidate.netScore - (nextCandidate?.netScore ?? 0) : 0
  const alternativeSupport = rankedCandidates.slice(1).reduce((sum, candidate) => sum + candidate.support, 0)
  const alternativeDensity = topCandidate && topCandidate.support > 0 ? alternativeSupport / topCandidate.support : 0

  const payload = {
    candidates: rankedCandidates,
    contradictionThreshold: input.contradictionThreshold,
    minimumMargin: input.minimumMargin,
    maximumAlternativeDensity: input.maximumAlternativeDensity,
    inferredFamily,
    topMargin,
    alternativeDensity,
  }

  if (topCandidate === null || topCandidate.contradiction >= input.contradictionThreshold) {
    return {
      verdict: 'fail',
      reason: 'tactic-hypothesis-contradicted',
      inferredFamily,
      topMargin,
      alternativeDensity,
      rankedCandidates,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'tactic-hypothesis-contradicted' }),
    }
  }

  if (topMargin < input.minimumMargin || alternativeDensity > input.maximumAlternativeDensity) {
    return {
      verdict: 'fail',
      reason: 'tactic-hypothesis-ambiguous',
      inferredFamily,
      topMargin,
      alternativeDensity,
      rankedCandidates,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'tactic-hypothesis-ambiguous' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'tactic-hypothesis-pass',
    inferredFamily,
    topMargin,
    alternativeDensity,
    rankedCandidates,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'tactic-hypothesis-pass' }),
  }
}
