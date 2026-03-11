import { describe, expect, it } from 'bun:test'

import {
  computeRunnerIntentBindingHash,
  evaluateBatchRunnerIdempotenceTask1,
} from '../src/batch-runner-idempotence-task1.ts'

describe('batch runner idempotence task1', () => {
  const baseInput = {
    chainId: 84532,
    arena: '0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e',
    actor: '0xd1033447B9A7297BDc91265EeD761fBE5A3B8961',
    operationType: 'accept-battle' as const,
    battleScope: 'battle:122',
    schemaVersion: 'v1',
    expectedSchemaVersion: 'v1',
    requiredIntentFields: ['agentId', 'secretHash'],
  }

  it('fails when retry payload mutates while reusing old provided hash', () => {
    const originalIntent = { agentId: 2, secretHash: '0xaaa', stakeWei: '1000000000000000' }
    const staleProvidedHash = computeRunnerIntentBindingHash({
      schemaVersion: baseInput.schemaVersion,
      operationType: baseInput.operationType,
      intent: originalIntent,
    })

    const mutatedIntent = { ...originalIntent, stakeWei: '2000000000000000' }

    const result = evaluateBatchRunnerIdempotenceTask1({
      ...baseInput,
      intent: mutatedIntent,
      providedIntentHash: staleProvidedHash,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('runner-op-intent-binding-invalid')
    expect(result.providedIntentHashMatchesComputed).toBe(false)
  })

  it('fails when required intent fields are missing', () => {
    const incompleteIntent = { agentId: 2, secretHash: '' }
    const providedHash = computeRunnerIntentBindingHash({
      schemaVersion: baseInput.schemaVersion,
      operationType: baseInput.operationType,
      intent: incompleteIntent,
    })

    const result = evaluateBatchRunnerIdempotenceTask1({
      ...baseInput,
      intent: incompleteIntent,
      providedIntentHash: providedHash,
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('runner-op-intent-binding-invalid')
    expect(result.missingIntentFields).toEqual(['secretHash'])
  })

  it('passes for schema-locked, fully bound canonical tuple', () => {
    const intent = { agentId: 2, secretHash: '0xbbb', stakeWei: '1000000000000000' }
    const providedHash = computeRunnerIntentBindingHash({
      schemaVersion: baseInput.schemaVersion,
      operationType: baseInput.operationType,
      intent,
    })

    const result = evaluateBatchRunnerIdempotenceTask1({
      ...baseInput,
      intent,
      providedIntentHash: providedHash,
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('runner-op-pass')
    expect(result.schemaVersionLocked).toBe(true)
    expect(result.providedIntentHashMatchesComputed).toBe(true)
    expect(result.missingIntentFields).toEqual([])
  })

  it('is deterministic for identical input tuples', () => {
    const intent = { agentId: 2, secretHash: '0xccc', stakeWei: '1000000000000000' }
    const providedHash = computeRunnerIntentBindingHash({
      schemaVersion: baseInput.schemaVersion,
      operationType: baseInput.operationType,
      intent,
    })

    const input = {
      ...baseInput,
      intent,
      providedIntentHash: providedHash,
    }

    const a = evaluateBatchRunnerIdempotenceTask1(input)
    const b = evaluateBatchRunnerIdempotenceTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
