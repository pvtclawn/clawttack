import { createHash } from 'node:crypto'

export type VerificationClaimCaveatReason = 'pass' | 'report-caveat-quality-insufficient'

export interface VerificationClaimCaveatInput {
  claimText: string
  caveatText: string
}

export interface VerificationClaimCaveatResult {
  verdict: 'pass' | 'fail'
  reason: VerificationClaimCaveatReason
  slotChecks: {
    scopeBound: boolean
    knownOpenRisk: boolean
    nonProvenStatement: boolean
  }
  missingSlots: Array<'scope-bound' | 'known-open-risk' | 'non-proven-statement'>
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

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim()

const sentenceHasSemanticDepth = (sentence: string): boolean => {
  const tokenCount = sentence.split(/\s+/).filter(Boolean).length
  return tokenCount >= 6
}

const hasPatternWithDepth = (text: string, patterns: RegExp[]): boolean => {
  const sentences = text.split(/[.!?]/).map((part) => part.trim()).filter(Boolean)
  return sentences.some((sentence) => sentenceHasSemanticDepth(sentence) && patterns.some((pattern) => pattern.test(sentence)))
}

const buildArtifactHash = (payload: unknown): `0x${string}` => {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex')
  return `0x${digest}`
}

export const evaluateVerificationClaimCaveatQuality = (
  input: VerificationClaimCaveatInput,
): VerificationClaimCaveatResult => {
  const claimText = normalize(input.claimText)
  const caveatText = normalize(input.caveatText)

  const scopeBoundPatterns = [
    /\blimited to\b/,
    /\bwithin (this|the) scope\b/,
    /\bdoes not cover\b/,
    /\bonly covers\b/,
    /\bscope:\b/,
  ]

  const knownOpenRiskPatterns = [
    /\bknown risk\b/,
    /\bopen (issue|regression|risk|bug)\b/,
    /\bunresolved\b/,
    /\bblocker\b/,
  ]

  const nonProvenPatterns = [
    /\bnot yet proven\b/,
    /\bnot (runtime|integration)?\s*verified\b/,
    /\bunverified\b/,
    /\bnot established in runtime\b/,
  ]

  const slotChecks = {
    scopeBound: hasPatternWithDepth(caveatText, scopeBoundPatterns),
    knownOpenRisk: hasPatternWithDepth(caveatText, knownOpenRiskPatterns),
    nonProvenStatement: hasPatternWithDepth(caveatText, nonProvenPatterns),
  }

  const missingSlots: Array<'scope-bound' | 'known-open-risk' | 'non-proven-statement'> = []
  if (!slotChecks.scopeBound) missingSlots.push('scope-bound')
  if (!slotChecks.knownOpenRisk) missingSlots.push('known-open-risk')
  if (!slotChecks.nonProvenStatement) missingSlots.push('non-proven-statement')

  const basePayload = {
    claimText,
    caveatText,
    slotChecks,
    missingSlots,
  }

  if (missingSlots.length > 0) {
    return {
      verdict: 'fail',
      reason: 'report-caveat-quality-insufficient',
      slotChecks,
      missingSlots,
      artifactHash: buildArtifactHash({ ...basePayload, verdict: 'fail', reason: 'report-caveat-quality-insufficient' }),
    }
  }

  return {
    verdict: 'pass',
    reason: 'pass',
    slotChecks,
    missingSlots,
    artifactHash: buildArtifactHash({ ...basePayload, verdict: 'pass', reason: 'pass' }),
  }
}
