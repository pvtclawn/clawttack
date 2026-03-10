import { describe, expect, it } from 'bun:test'
import {
  evaluateIdentityEvidenceTask1,
  type IdentityEvidenceEnvelope,
  type IdentityEvidenceTask1Config,
} from '../src/identity-evidence-admission'

const CONFIG: IdentityEvidenceTask1Config = {
  minIssuerDiversity: 0.45,
  minIdentityContinuityBlocks: 100,
  maxIssuerClusterConcentration: 0.65,
  maxEvidenceAgeBlocks: 8_000,
  minWeightedQuality: 0.5,
}

const mkEnvelope = (
  overrides?: Partial<IdentityEvidenceEnvelope>,
): IdentityEvidenceEnvelope => ({
  identityRef: 'agent:0xeC6cd01f6fdeaEc192b88Eb7B62f5E72D65719Af',
  identityContinuityBlocks: 600,
  evidence: [
    {
      issuerId: 'issuer-A',
      issuerClusterId: 'cluster-A',
      issuerReputation: 0.9,
      evidenceStrength: 0.8,
      evidenceAgeBlocks: 120,
    },
    {
      issuerId: 'issuer-B',
      issuerClusterId: 'cluster-B',
      issuerReputation: 0.85,
      evidenceStrength: 0.75,
      evidenceAgeBlocks: 200,
    },
    {
      issuerId: 'issuer-C',
      issuerClusterId: 'cluster-C',
      issuerReputation: 0.8,
      evidenceStrength: 0.7,
      evidenceAgeBlocks: 350,
    },
  ],
  ...overrides,
})

describe('identity-evidence admission task-1', () => {
  it('returns deterministic metrics and artifact hash for identical input', () => {
    const envelope = mkEnvelope()

    const a = evaluateIdentityEvidenceTask1(envelope, CONFIG)
    const b = evaluateIdentityEvidenceTask1(envelope, CONFIG)

    expect(a).toEqual(b)
    expect(a.artifactHash.startsWith('0x')).toBe(true)
    expect(a.verdict).toBe('pass')
    expect(a.reason).toBe('pass')
  })

  it('fails collusive low-diversity evidence with deterministic issuer-diversity reason', () => {
    const envelope = mkEnvelope({
      evidence: [
        {
          issuerId: 'issuer-A',
          issuerClusterId: 'cluster-same',
          issuerReputation: 0.95,
          evidenceStrength: 0.9,
          evidenceAgeBlocks: 50,
        },
        {
          issuerId: 'issuer-A',
          issuerClusterId: 'cluster-same',
          issuerReputation: 0.94,
          evidenceStrength: 0.92,
          evidenceAgeBlocks: 75,
        },
        {
          issuerId: 'issuer-A',
          issuerClusterId: 'cluster-same',
          issuerReputation: 0.96,
          evidenceStrength: 0.88,
          evidenceAgeBlocks: 120,
        },
      ],
    })

    const result = evaluateIdentityEvidenceTask1(envelope, CONFIG)

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('issuer-diversity-insufficient')
    expect(result.metrics.issuerDiversity).toBeLessThan(CONFIG.minIssuerDiversity)
  })

  it('fails high-count but low-quality evidence (anti-count-only pass)', () => {
    const envelope = mkEnvelope({
      evidence: Array.from({ length: 8 }, (_, idx) => ({
        issuerId: `issuer-${idx + 1}`,
        issuerClusterId: `cluster-${idx + 1}`,
        issuerReputation: 0.2,
        evidenceStrength: 0.15,
        evidenceAgeBlocks: 30,
      })),
    })

    const result = evaluateIdentityEvidenceTask1(envelope, CONFIG)

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('evidence-quality-insufficient')
    expect(result.metrics.issuerCount).toBe(8)
    expect(result.metrics.weightedQuality).toBeLessThan(CONFIG.minWeightedQuality)
  })

  it('fails closed on missing identity reference', () => {
    const envelope = mkEnvelope({ identityRef: '' })

    const result = evaluateIdentityEvidenceTask1(envelope, CONFIG)

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('identity-missing')
  })
})
