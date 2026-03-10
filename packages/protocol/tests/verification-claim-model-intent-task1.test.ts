import { describe, expect, it } from 'bun:test'

import { evaluateVerificationClaimModelIntentTask1 } from '../src/verification-claim-model-intent-task1.ts'

describe('verification claim model-intent task1', () => {
  const expectedMatrixVersion = 'v1.0.0'
  const expectedMatrixHash = '0xabc123'

  it('fails when intent provenance is invalid', () => {
    const result = evaluateVerificationClaimModelIntentTask1({
      claimIntent: 'practical-operational',
      evidence: [{ id: 'e1', intent: 'theoretical-bound', intentProvenanceValid: false }],
      matrix: { version: expectedMatrixVersion, hash: expectedMatrixHash },
      expectedMatrixVersion,
      expectedMatrixHash,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('model-intent-label-invalid')
    expect(result.invalidEvidenceIds).toEqual(['e1'])
  })

  it('fails when matrix version/hash drift is detected', () => {
    const result = evaluateVerificationClaimModelIntentTask1({
      claimIntent: 'practical-operational',
      evidence: [{ id: 'e2', intent: 'practical-operational', intentProvenanceValid: true }],
      matrix: { version: 'v1.0.1', hash: expectedMatrixHash },
      expectedMatrixVersion,
      expectedMatrixHash,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('model-intent-matrix-drift')
    expect(result.matrixLocked).toBe(false)
  })

  it('passes when intent provenance and matrix lock are valid', () => {
    const result = evaluateVerificationClaimModelIntentTask1({
      claimIntent: 'practical-operational',
      evidence: [{ id: 'e3', intent: 'practical-operational', intentProvenanceValid: true }],
      matrix: { version: expectedMatrixVersion, hash: expectedMatrixHash },
      expectedMatrixVersion,
      expectedMatrixHash,
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('model-intent-pass')
    expect(result.matrixLocked).toBe(true)
  })

  it('is deterministic for identical input tuples', () => {
    const input = {
      claimIntent: 'hybrid-consensus' as const,
      evidence: [{ id: 'e4', intent: 'hybrid-consensus' as const, intentProvenanceValid: true }],
      matrix: { version: expectedMatrixVersion, hash: expectedMatrixHash },
      expectedMatrixVersion,
      expectedMatrixHash,
    }

    const a = evaluateVerificationClaimModelIntentTask1(input)
    const b = evaluateVerificationClaimModelIntentTask1(input)
    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
