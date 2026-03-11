import { createHash } from 'node:crypto'

import type { TacticOutputTask1Mode } from './tactic-output-task1.ts'

export type TacticOutputPublicTask1Mode =
  | 'tactic-output-public-safe'
  | 'tactic-output-redacted'
  | 'tactic-output-blocked'

export interface TacticOutputPublicTask1Input {
  outputMode: TacticOutputTask1Mode
  machineTrustFlag: 'trusted' | 'degraded-low-trust' | 'blocked-untrusted'
  verificationTier: 'primary' | 'backup' | 'degraded' | 'blocked'
  candidateSetSummary: string[]
  caveat: string
  detailCost: number
  detailBudget: number
  hostileRisk: boolean
}

export interface TacticOutputPublicTask1Artifact {
  publicMode: 'public-safe' | 'redacted' | 'blocked'
  trustLabel: 'trusted' | 'low-trust' | 'blocked'
  publicTier: 'normal' | 'degraded' | 'blocked'
  publicCandidateSummary: string[]
  publicCaveat: string
  detailDisposition: 'full' | 'redacted' | 'blocked'
}

export interface TacticOutputPublicTask1Result {
  mode: TacticOutputPublicTask1Mode
  artifact: TacticOutputPublicTask1Artifact
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

const normalizeSummary = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  )

const normalizeText = (value: string): string => value.trim()

const clampBudget = (value: number): number => Math.max(0, value)

export const evaluateTacticOutputPublicTask1 = (
  input: TacticOutputPublicTask1Input,
): TacticOutputPublicTask1Result => {
  const candidateSetSummary = normalizeSummary(input.candidateSetSummary)
  const caveat = normalizeText(input.caveat)
  const detailCost = clampBudget(input.detailCost)
  const detailBudget = clampBudget(input.detailBudget)

  if (
    input.hostileRisk ||
    input.outputMode === 'tactic-output-fail-closed' ||
    input.machineTrustFlag === 'blocked-untrusted'
  ) {
    const artifact: TacticOutputPublicTask1Artifact = {
      publicMode: 'blocked',
      trustLabel: 'blocked',
      publicTier: 'blocked',
      publicCandidateSummary: [],
      publicCaveat: 'Public output blocked for safety.',
      detailDisposition: 'blocked',
    }

    return {
      mode: 'tactic-output-blocked',
      artifact,
      artifactHash: sha256({ input: { ...input, candidateSetSummary, caveat, detailCost, detailBudget }, mode: 'tactic-output-blocked', artifact }),
    }
  }

  const shouldRedact = detailCost > detailBudget

  if (shouldRedact) {
    const artifact: TacticOutputPublicTask1Artifact = {
      publicMode: 'redacted',
      trustLabel: input.machineTrustFlag === 'degraded-low-trust' ? 'low-trust' : 'trusted',
      publicTier: input.verificationTier === 'degraded' ? 'degraded' : 'normal',
      publicCandidateSummary: candidateSetSummary.slice(0, 1),
      publicCaveat: caveat.length > 0 ? caveat : 'Public output redacted to reduce verifier-state leakage.',
      detailDisposition: 'redacted',
    }

    return {
      mode: 'tactic-output-redacted',
      artifact,
      artifactHash: sha256({ input: { ...input, candidateSetSummary, caveat, detailCost, detailBudget }, mode: 'tactic-output-redacted', artifact }),
    }
  }

  const artifact: TacticOutputPublicTask1Artifact = {
    publicMode: 'public-safe',
    trustLabel: input.machineTrustFlag === 'degraded-low-trust' ? 'low-trust' : 'trusted',
    publicTier: input.verificationTier === 'degraded' ? 'degraded' : 'normal',
    publicCandidateSummary: candidateSetSummary,
    publicCaveat: caveat.length > 0 ? caveat : 'Public-safe output.',
    detailDisposition: 'full',
  }

  return {
    mode: 'tactic-output-public-safe',
    artifact,
    artifactHash: sha256({ input: { ...input, candidateSetSummary, caveat, detailCost, detailBudget }, mode: 'tactic-output-public-safe', artifact }),
  }
}
