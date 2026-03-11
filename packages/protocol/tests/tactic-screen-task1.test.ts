import { describe, expect, it } from 'bun:test'

import { evaluateTacticScreenTask1, type TacticScreenTask1Input } from '../src/tactic-screen-task1.ts'

describe('tactic screen task1', () => {
  const baseInput: TacticScreenTask1Input = {
    declaredFamily: 'prompt-injection',
    objectiveWitness: 'Attempts to override the defender instruction hierarchy.',
    effectWitness: 'Expected to force a system-level compliance pivot.',
    minimumStrongSupport: 0.6,
    maximumLexicalShare: 0.45,
    features: [
      {
        featureId: 'override-directive-graph',
        family: 'prompt-injection',
        confidence: 0.6,
        provenance: 'runtime-behavior',
      },
      {
        featureId: 'system-target-structure',
        family: 'prompt-injection',
        confidence: 0.2,
        provenance: 'derived-structural',
      },
      {
        featureId: 'friendly-wrapper-copy',
        family: 'social-engineering',
        confidence: 0.2,
        provenance: 'lexical-cue',
      },
    ],
  }

  it('fails decorative-marker laundering as feature theater', () => {
    const result = evaluateTacticScreenTask1({
      ...baseInput,
      features: [
        {
          featureId: 'override-slogan',
          family: 'prompt-injection',
          confidence: 0.95,
          provenance: 'lexical-cue',
        },
        {
          featureId: 'puzzle-gloss',
          family: 'ctf-lure',
          confidence: 0.2,
          provenance: 'lexical-cue',
        },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('tactic-screen-feature-theater-risk')
    expect(result.inferredFamily).toBe('prompt-injection')
    expect(result.strongFamilySupport['prompt-injection']).toBe(0)
  })

  it('fails when objective or effect witnesses are missing', () => {
    const result = evaluateTacticScreenTask1({
      ...baseInput,
      effectWitness: '   ',
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('tactic-screen-objective-effect-missing')
  })

  it('passes when declared family aligns with strong screened evidence and witnesses', () => {
    const result = evaluateTacticScreenTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('tactic-screen-pass')
    expect(result.inferredFamily).toBe('prompt-injection')
    expect(result.strongFamilySupport['prompt-injection']).toBeCloseTo(0.76, 6)
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTacticScreenTask1(baseInput)
    const b = evaluateTacticScreenTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
