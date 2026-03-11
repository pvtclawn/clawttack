import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticEvidenceTask1,
  type TacticEvidenceTask1Input,
} from '../src/tactic-evidence-task1.ts'

describe('tactic evidence task1', () => {
  const baseInput: TacticEvidenceTask1Input = {
    declaredFamily: 'prompt-injection',
    ambiguityMargin: 0.1,
    signals: [
      { signalId: 'intent-override', family: 'prompt-injection', confidence: 0.55 },
      { signalId: 'target-system-prompt', family: 'prompt-injection', confidence: 0.25 },
      { signalId: 'roleplay-wrapper', family: 'social-engineering', confidence: 0.1 },
    ],
  }

  it('fails when declared family does not match the strongest evidence family', () => {
    const result = evaluateTacticEvidenceTask1({
      ...baseInput,
      declaredFamily: 'social-engineering',
      signals: [
        { signalId: 'intent-override', family: 'prompt-injection', confidence: 0.5 },
        { signalId: 'system-target', family: 'prompt-injection', confidence: 0.35 },
        { signalId: 'friendly-wrapper', family: 'social-engineering', confidence: 0.1 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('tactic-evidence-label-spoof-risk')
    expect(result.inferredFamily).toBe('prompt-injection')
  })

  it('fails closed when tactic evidence is ambiguous', () => {
    const result = evaluateTacticEvidenceTask1({
      ...baseInput,
      signals: [
        { signalId: 'intent-override', family: 'prompt-injection', confidence: 0.45 },
        { signalId: 'persona-lure', family: 'social-engineering', confidence: 0.42 },
        { signalId: 'stage-setting', family: 'social-engineering', confidence: 0.08 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('tactic-evidence-ambiguous-family')
    expect(result.inferredFamily).toBeNull()
    expect(result.ambiguousFamilies).toEqual(['prompt-injection', 'social-engineering'])
  })

  it('passes when declared family aligns with a unique strongest evidence family', () => {
    const result = evaluateTacticEvidenceTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('tactic-evidence-pass')
    expect(result.inferredFamily).toBe('prompt-injection')
    expect(result.familySupport['prompt-injection']).toBeCloseTo(0.8, 6)
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTacticEvidenceTask1(baseInput)
    const b = evaluateTacticEvidenceTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
