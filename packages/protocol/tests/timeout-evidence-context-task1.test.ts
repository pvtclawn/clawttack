import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutEvidenceContextTask1,
  type TimeoutEvidenceContextTask1Input,
} from '../src/timeout-evidence-context-task1.ts'

describe('timeout evidence context task1', () => {
  const baseInput: TimeoutEvidenceContextTask1Input = {
    expectedContext: {
      chainId: 84532,
      arena: '0x2ab05eab902db3fda647b3ec798c2d28c7489b7e',
      operationType: 'accept-battle',
      operationId: 'accept-battle#137',
      probeClass: 'rpc',
      providerId: 'base-sepolia-rpc-a',
      windowId: 'w-1773189',
      counter: 12,
    },
    evidenceContext: {
      chainId: 84532,
      arena: '0x2ab05eab902db3fda647b3ec798c2d28c7489b7e',
      operationType: 'accept-battle',
      operationId: 'accept-battle#137',
      probeClass: 'rpc',
      providerId: 'base-sepolia-rpc-a',
      windowId: 'w-1773189',
      counter: 12,
    },
  }

  it('fails canonicalization-invalid on non-canonical context aliases', () => {
    const result = evaluateTimeoutEvidenceContextTask1({
      ...baseInput,
      evidenceContext: {
        ...baseInput.evidenceContext,
        arena: '0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e',
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-evidence-canonicalization-invalid')
  })

  it('fails operation-scope-mismatch on cross-operation graft attempts', () => {
    const result = evaluateTimeoutEvidenceContextTask1({
      ...baseInput,
      evidenceContext: {
        ...baseInput.evidenceContext,
        operationType: 'claim-timeout',
        operationId: 'claim-timeout#137',
      },
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-evidence-operation-scope-mismatch')
  })

  it('passes for canonical and scope-matching context tuples', () => {
    const result = evaluateTimeoutEvidenceContextTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-evidence-context-pass')
  })

  it('is deterministic for identical input tuples', () => {
    const a = evaluateTimeoutEvidenceContextTask1(baseInput)
    const b = evaluateTimeoutEvidenceContextTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.contextHash).toBe(b.contextHash)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
