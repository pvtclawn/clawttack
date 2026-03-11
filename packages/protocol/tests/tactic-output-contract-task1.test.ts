import { describe, expect, it } from 'bun:test'

import {
  compileTacticOutputContractTask1,
  type TacticOutputContractTask1Input,
} from '../src/tactic-output-contract-task1.ts'

describe('tactic output contract task1', () => {
  const baseInput: TacticOutputContractTask1Input = {
    caseKey: 'battle-27-turn-3',
    blocked: false,
    publicFields: {
      mode: 'public-safe',
      trustLabel: 'trusted',
      summary: 'prompt-injection',
    },
    auditFields: {
      routeTrace: 'backup-path -> redacted',
      budgetState: 'actor=0.25;context=0.40',
      contradictionScore: '0.18',
    },
    publicAllowlist: ['mode', 'summary', 'trustLabel'],
  }

  it('yields a public contract with only allowlisted fields', () => {
    const result = compileTacticOutputContractTask1(baseInput)

    expect(result.mode).toBe('tactic-output-contract-public')
    expect(result.publicArtifact.fields).toEqual({
      mode: 'public-safe',
      summary: 'prompt-injection',
      trustLabel: 'trusted',
    })
    expect(result.publicArtifact.fields.routeTrace).toBeUndefined()
  })

  it('preserves richer audit-only fields in the audit contract', () => {
    const result = compileTacticOutputContractTask1(baseInput)

    expect(result.auditArtifact.fields).toEqual({
      budgetState: 'actor=0.25;context=0.40',
      contradictionScore: '0.18',
      mode: 'public-safe',
      routeTrace: 'backup-path -> redacted',
      summary: 'prompt-injection',
      trustLabel: 'trusted',
    })
  })

  it('shares stable linked identity and blocks correctly for blocked cases', () => {
    const result = compileTacticOutputContractTask1({
      ...baseInput,
      blocked: true,
    })

    expect(result.mode).toBe('tactic-output-contract-blocked')
    expect(result.publicArtifact.linkedIdentity).toBe(result.auditArtifact.linkedIdentity)
    expect(result.publicArtifact.fields).toEqual({ status: 'blocked' })
    expect(result.auditArtifact.fields.status).toBe('blocked')
    expect(result.auditArtifact.fields.routeTrace).toBe('backup-path -> redacted')
  })

  it('is deterministic for identical inputs', () => {
    const a = compileTacticOutputContractTask1(baseInput)
    const b = compileTacticOutputContractTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.publicArtifactHash).toBe(b.publicArtifactHash)
    expect(a.auditArtifactHash).toBe(b.auditArtifactHash)
  })
})
