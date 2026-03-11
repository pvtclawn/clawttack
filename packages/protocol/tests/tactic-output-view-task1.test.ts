import { describe, expect, it } from 'bun:test'

import {
  compileTacticOutputViewTask1,
  type TacticOutputViewTask1Input,
} from '../src/tactic-output-view-task1.ts'

describe('tactic output view task1', () => {
  const baseInput: TacticOutputViewTask1Input = {
    role: 'public-reader',
    linkedIdentity: '0xac782acf65b5e450d3a0cde2ce0755ad162ed448836a360f08631af449a51a0e',
    publicFields: {
      mode: 'public-safe',
      summary: 'prompt-injection',
      trustLabel: 'trusted',
    },
    auditFields: {
      routeTrace: 'backup-path -> redacted',
      budgetState: 'actor=0.25;context=0.40',
      contradictionScore: '0.18',
      aggregateCount: '7',
      verifierHints: 'candidate-margin=0.62',
    },
    roleMatrix: {
      'public-reader': ['mode', 'summary', 'trustLabel'],
      'operator-debug': ['mode', 'summary', 'trustLabel', 'routeTrace', 'budgetState', 'contradictionScore'],
      'research-metrics': ['mode', 'summary', 'aggregateCount'],
      'internal-verifier': [
        'mode',
        'summary',
        'trustLabel',
        'routeTrace',
        'budgetState',
        'contradictionScore',
        'aggregateCount',
        'verifierHints',
      ],
    },
  }

  it('gives public-reader only minimal public-safe fields', () => {
    const result = compileTacticOutputViewTask1(baseInput)

    expect(result.mode).toBe('tactic-output-view-public-reader')
    expect(result.artifact.fields).toEqual({
      mode: 'public-safe',
      summary: 'prompt-injection',
      trustLabel: 'trusted',
    })
  })

  it('gives operator-debug route and risk context absent from public-reader', () => {
    const result = compileTacticOutputViewTask1({
      ...baseInput,
      role: 'operator-debug',
    })

    expect(result.mode).toBe('tactic-output-view-operator-debug')
    expect(result.artifact.fields).toEqual({
      budgetState: 'actor=0.25;context=0.40',
      contradictionScore: '0.18',
      mode: 'public-safe',
      routeTrace: 'backup-path -> redacted',
      summary: 'prompt-injection',
      trustLabel: 'trusted',
    })
  })

  it('gives research-metrics aggregate-friendly fields without raw internals', () => {
    const result = compileTacticOutputViewTask1({
      ...baseInput,
      role: 'research-metrics',
    })

    expect(result.mode).toBe('tactic-output-view-research-metrics')
    expect(result.artifact.fields).toEqual({
      aggregateCount: '7',
      mode: 'public-safe',
      summary: 'prompt-injection',
    })
    expect(result.artifact.fields.routeTrace).toBeUndefined()
  })

  it('gives internal-verifier the richest machine-oriented structure from the matrix', () => {
    const result = compileTacticOutputViewTask1({
      ...baseInput,
      role: 'internal-verifier',
    })

    expect(result.mode).toBe('tactic-output-view-internal-verifier')
    expect(result.artifact.fields).toEqual({
      aggregateCount: '7',
      budgetState: 'actor=0.25;context=0.40',
      contradictionScore: '0.18',
      mode: 'public-safe',
      routeTrace: 'backup-path -> redacted',
      summary: 'prompt-injection',
      trustLabel: 'trusted',
      verifierHints: 'candidate-margin=0.62',
    })
  })

  it('is deterministic for identical inputs', () => {
    const a = compileTacticOutputViewTask1(baseInput)
    const b = compileTacticOutputViewTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
