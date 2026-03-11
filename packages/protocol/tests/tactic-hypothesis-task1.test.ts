import { describe, expect, it } from 'bun:test'

import {
  evaluateTacticHypothesisTask1,
  type TacticHypothesisTask1Input,
} from '../src/tactic-hypothesis-task1.ts'

describe('tactic hypothesis task1', () => {
  const baseInput: TacticHypothesisTask1Input = {
    contradictionThreshold: 0.5,
    minimumMargin: 0.2,
    maximumAlternativeDensity: 0.75,
    candidates: [
      { family: 'prompt-injection', support: 0.9, contradiction: 0.1 },
      { family: 'social-engineering', support: 0.2, contradiction: 0.05 },
      { family: 'ctf-lure', support: 0.1, contradiction: 0.05 },
    ],
  }

  it('passes with a strong clean single-family candidate set', () => {
    const result = evaluateTacticHypothesisTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('tactic-hypothesis-pass')
    expect(result.inferredFamily).toBe('prompt-injection')
    expect(result.topMargin).toBeGreaterThanOrEqual(0.2)
  })

  it('degrades hypothesis-padding into an ambiguous verdict', () => {
    const result = evaluateTacticHypothesisTask1({
      ...baseInput,
      candidates: [
        { family: 'prompt-injection', support: 0.82, contradiction: 0.05 },
        { family: 'social-engineering', support: 0.42, contradiction: 0.02 },
        { family: 'ctf-lure', support: 0.31, contradiction: 0.01 },
        { family: 'dos-noise', support: 0.19, contradiction: 0.01 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('tactic-hypothesis-ambiguous')
    expect(result.inferredFamily).toBe('prompt-injection')
    expect(result.alternativeDensity).toBeGreaterThan(0.75)
  })

  it('fails contradiction-heavy winners as contradicted', () => {
    const result = evaluateTacticHypothesisTask1({
      ...baseInput,
      candidates: [
        { family: 'prompt-injection', support: 0.88, contradiction: 0.62 },
        { family: 'social-engineering', support: 0.3, contradiction: 0.05 },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('tactic-hypothesis-contradicted')
    expect(result.inferredFamily).toBe('prompt-injection')
  })

  it('is deterministic for identical candidate sets', () => {
    const a = evaluateTacticHypothesisTask1(baseInput)
    const b = evaluateTacticHypothesisTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
