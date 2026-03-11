import { createHash } from 'node:crypto'

export type TacticEvidenceTask1Family =
  | 'prompt-injection'
  | 'ctf-lure'
  | 'dos-noise'
  | 'social-engineering'
  | 'joker'
  | 'other'

export type TacticEvidenceTask1Reason =
  | 'tactic-evidence-pass'
  | 'tactic-evidence-label-spoof-risk'
  | 'tactic-evidence-ambiguous-family'

export interface TacticEvidenceTask1Signal {
  signalId: string
  family: TacticEvidenceTask1Family
  confidence: number
}

export interface TacticEvidenceTask1Input {
  declaredFamily: TacticEvidenceTask1Family
  ambiguityMargin: number
  signals: TacticEvidenceTask1Signal[]
}

export interface TacticEvidenceTask1Result {
  verdict: 'pass' | 'fail'
  reason: TacticEvidenceTask1Reason
  inferredFamily: TacticEvidenceTask1Family | null
  ambiguousFamilies: TacticEvidenceTask1Family[]
  familySupport: Record<TacticEvidenceTask1Family, number>
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

const normalizeSignalId = (value: string): string => value.trim().toLowerCase()

const createEmptyFamilySupport = (): Record<TacticEvidenceTask1Family, number> => ({
  'prompt-injection': 0,
  'ctf-lure': 0,
  'dos-noise': 0,
  'social-engineering': 0,
  joker: 0,
  other: 0,
})

export const evaluateTacticEvidenceTask1 = (
  input: TacticEvidenceTask1Input,
): TacticEvidenceTask1Result => {
  const normalizedSignals = input.signals
    .map((signal) => ({
      signalId: normalizeSignalId(signal.signalId),
      family: signal.family,
      confidence: clamp01(signal.confidence),
    }))
    .sort((a, b) => a.signalId.localeCompare(b.signalId) || a.family.localeCompare(b.family))

  const familySupport = createEmptyFamilySupport()
  for (const signal of normalizedSignals) {
    familySupport[signal.family] += signal.confidence
  }

  const rankedFamilies = [...TACTIC_FAMILIES]
    .map((family) => ({ family, support: familySupport[family] }))
    .sort((a, b) => b.support - a.support || a.family.localeCompare(b.family))

  const topSupport = rankedFamilies[0]?.support ?? 0
  const ambiguousFamilies = rankedFamilies
    .filter(({ support }) => topSupport - support <= input.ambiguityMargin)
    .map(({ family }) => family)
    .sort((a, b) => a.localeCompare(b))

  const inferredFamily = ambiguousFamilies.length === 1 ? (ambiguousFamilies[0] ?? null) : null

  const payload = {
    declaredFamily: input.declaredFamily,
    ambiguityMargin: input.ambiguityMargin,
    signals: normalizedSignals,
    familySupport,
    ambiguousFamilies,
    inferredFamily,
  }

  if (ambiguousFamilies.length !== 1) {
    return {
      verdict: 'fail',
      reason: 'tactic-evidence-ambiguous-family',
      inferredFamily,
      ambiguousFamilies,
      familySupport,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'tactic-evidence-ambiguous-family' }),
    }
  }

  if (inferredFamily !== input.declaredFamily) {
    return {
      verdict: 'fail',
      reason: 'tactic-evidence-label-spoof-risk',
      inferredFamily,
      ambiguousFamilies,
      familySupport,
      artifactHash: sha256({ ...payload, verdict: 'fail', reason: 'tactic-evidence-label-spoof-risk' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'tactic-evidence-pass',
    inferredFamily,
    ambiguousFamilies,
    familySupport,
    artifactHash: sha256({ ...payload, verdict: 'pass', reason: 'tactic-evidence-pass' }),
  }
}
