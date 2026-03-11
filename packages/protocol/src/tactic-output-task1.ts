import { createHash } from 'node:crypto'

import type { TacticRoutingTask1Outcome } from './tactic-routing-task1.ts'

export type TacticOutputTask1Mode =
  | 'tactic-output-primary'
  | 'tactic-output-backup'
  | 'tactic-output-degraded-fallback'
  | 'tactic-output-fail-closed'

export interface TacticOutputTask1Input {
  routingOutcome: TacticRoutingTask1Outcome
  hostileRisk: boolean
  lowTrustSummary: string
  candidateSetSummary: string[]
}

export interface TacticOutputTask1Artifact {
  trustLevel: 'high' | 'medium' | 'low' | 'none'
  verificationTier: 'primary' | 'backup' | 'degraded' | 'blocked'
  machineTrustFlag: 'trusted' | 'degraded-low-trust' | 'blocked-untrusted'
  candidateSetSummary: string[]
  caveat: string
}

export interface TacticOutputTask1Result {
  mode: TacticOutputTask1Mode
  artifact: TacticOutputTask1Artifact
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

export const evaluateTacticOutputTask1 = (input: TacticOutputTask1Input): TacticOutputTask1Result => {
  const candidateSetSummary = normalizeSummary(input.candidateSetSummary)
  const lowTrustSummary = normalizeText(input.lowTrustSummary)

  if (input.hostileRisk || input.routingOutcome === 'tactic-routing-fail-closed') {
    const artifact: TacticOutputTask1Artifact = {
      trustLevel: 'none',
      verificationTier: 'blocked',
      machineTrustFlag: 'blocked-untrusted',
      candidateSetSummary: [],
      caveat: 'Verification blocked due to hostile-risk conditions.',
    }

    return {
      mode: 'tactic-output-fail-closed',
      artifact,
      artifactHash: sha256({ input: { ...input, candidateSetSummary, lowTrustSummary }, mode: 'tactic-output-fail-closed', artifact }),
    }
  }

  if (input.routingOutcome === 'tactic-routing-primary-path') {
    const artifact: TacticOutputTask1Artifact = {
      trustLevel: 'high',
      verificationTier: 'primary',
      machineTrustFlag: 'trusted',
      candidateSetSummary,
      caveat: 'Primary-path verification completed.',
    }

    return {
      mode: 'tactic-output-primary',
      artifact,
      artifactHash: sha256({ input: { ...input, candidateSetSummary, lowTrustSummary }, mode: 'tactic-output-primary', artifact }),
    }
  }

  if (input.routingOutcome === 'tactic-routing-backup-path') {
    const artifact: TacticOutputTask1Artifact = {
      trustLevel: 'medium',
      verificationTier: 'backup',
      machineTrustFlag: 'trusted',
      candidateSetSummary,
      caveat: 'Backup-path verification completed with richer checks.',
    }

    return {
      mode: 'tactic-output-backup',
      artifact,
      artifactHash: sha256({ input: { ...input, candidateSetSummary, lowTrustSummary }, mode: 'tactic-output-backup', artifact }),
    }
  }

  const artifact: TacticOutputTask1Artifact = {
    trustLevel: 'low',
    verificationTier: 'degraded',
    machineTrustFlag: 'degraded-low-trust',
    candidateSetSummary,
    caveat:
      lowTrustSummary.length > 0
        ? `Degraded fallback only: ${lowTrustSummary}`
        : 'Degraded fallback only: richer verification was not performed.',
  }

  return {
    mode: 'tactic-output-degraded-fallback',
    artifact,
    artifactHash: sha256({ input: { ...input, candidateSetSummary, lowTrustSummary }, mode: 'tactic-output-degraded-fallback', artifact }),
  }
}
