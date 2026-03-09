import { describe, expect, it } from 'bun:test'
import {
  computeRiskAwareConfidence,
  detectConfidenceGaming,
} from '../src/risk-aware-rating'

describe('risk-aware confidence provenance + conservative fallback', () => {
  it('reports provenance counts and per-feature provenance metadata', () => {
    const result = computeRiskAwareConfidence({
      turnCompleteness: { value: 0.9, provenance: 'chain' },
      timeoutPressure: { value: 0.2, provenance: 'asserted' },
      replayIntegrity: { value: null, provenance: 'missing' },
    })

    expect(result.chainFeatureCount).toBe(1)
    expect(result.assertedFeatureCount).toBe(1)
    expect(result.missingFeatureCount).toBe(1)

    const replayFeature = result.featureScores.find((f) => f.name === 'replayIntegrity')
    expect(replayFeature?.inputProvenance).toBe('missing')
    expect(replayFeature?.notes).toContain('missing-evidence-fallback')
  })

  it('missing/unverifiable evidence cannot increase confidence', () => {
    const allChain = computeRiskAwareConfidence({
      turnCompleteness: { value: 0.9, provenance: 'chain' },
      timeoutPressure: { value: 0.1, provenance: 'chain' },
      replayIntegrity: { value: 0.95, provenance: 'chain' },
    })

    const withMissing = computeRiskAwareConfidence({
      turnCompleteness: { value: 0.9, provenance: 'chain' },
      timeoutPressure: { value: 0.1, provenance: 'chain' },
      replayIntegrity: { value: undefined, provenance: 'missing' },
    })

    expect(withMissing.confidence).toBeLessThan(allChain.confidence)
    expect(withMissing.capsApplied).toContain('missing-evidence-cap')
  })
})

describe('risk-aware confidence gaming detection', () => {
  it('flags repeated self-induced uncertainty patterns', () => {
    const detection = detectConfidenceGaming({
      selfInducedUncertaintyEvents: 6,
      totalBattlesObserved: 10,
      repeatedMissingEvidenceEvents: 0,
      ratioThreshold: 0.5,
      minEvents: 3,
    })

    expect(detection.suspicious).toBe(true)
    expect(detection.reasons).toContain('self-induced-uncertainty-pattern')
    expect(detection.penaltyMultiplier).toBeLessThan(1)
  })

  it('applies suspicious-pattern penalty to final confidence', () => {
    const noPenalty = computeRiskAwareConfidence(
      {
        turnCompleteness: { value: 0.85, provenance: 'chain' },
        timeoutPressure: { value: 0.25, provenance: 'chain' },
        replayIntegrity: { value: 0.9, provenance: 'asserted' },
      },
      {
        selfInducedUncertaintyEvents: 1,
        totalBattlesObserved: 10,
        repeatedMissingEvidenceEvents: 0,
      },
    )

    const penalized = computeRiskAwareConfidence(
      {
        turnCompleteness: { value: 0.85, provenance: 'chain' },
        timeoutPressure: { value: 0.25, provenance: 'chain' },
        replayIntegrity: { value: 0.9, provenance: 'asserted' },
      },
      {
        selfInducedUncertaintyEvents: 7,
        totalBattlesObserved: 10,
        repeatedMissingEvidenceEvents: 4,
      },
    )

    expect(penalized.gamingDetection.suspicious).toBe(true)
    expect(penalized.confidence).toBeLessThan(noPenalty.confidence)
  })
})
