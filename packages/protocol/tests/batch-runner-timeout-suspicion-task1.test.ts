import { describe, expect, it } from 'bun:test'

import {
  evaluateBatchRunnerTimeoutSuspicionTask1,
  type BatchRunnerTimeoutSuspicionTask1Input,
} from '../src/batch-runner-timeout-suspicion-task1.ts'

describe('batch runner timeout suspicion task1', () => {
  const baseInput: BatchRunnerTimeoutSuspicionTask1Input = {
    operationId: 'accept#127',
    retryCount: 3,
    requiredFailureProbeCount: 2,
    requiredDistinctCorrelationGroups: 2,
    observations: [],
  }

  it('fails correlated failure confirmations with correlation risk reason', () => {
    const result = evaluateBatchRunnerTimeoutSuspicionTask1({
      ...baseInput,
      observations: [
        {
          probeClass: 'rpc',
          providerId: 'base-rpc-1',
          correlationGroup: 'public-rpc-cluster-a',
          outcome: 'failure',
        },
        {
          probeClass: 'state-read',
          providerId: 'base-rpc-2',
          correlationGroup: 'public-rpc-cluster-a',
          outcome: 'failure',
        },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('runner-timeout-confirmation-correlation-risk')
  })

  it('passes independent convergent failure confirmations', () => {
    const result = evaluateBatchRunnerTimeoutSuspicionTask1({
      ...baseInput,
      observations: [
        {
          probeClass: 'rpc',
          providerId: 'base-rpc-1',
          correlationGroup: 'public-rpc-cluster-a',
          outcome: 'failure',
        },
        {
          probeClass: 'tx-receipt',
          providerId: 'alt-rpc-1',
          correlationGroup: 'independent-rpc-cluster-b',
          outcome: 'failure',
        },
      ],
    })

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('runner-timeout-confirmed-failure')
  })

  it('stays suspect when independent confirmation threshold is not met', () => {
    const result = evaluateBatchRunnerTimeoutSuspicionTask1({
      ...baseInput,
      observations: [
        {
          probeClass: 'rpc',
          providerId: 'base-rpc-1',
          correlationGroup: 'public-rpc-cluster-a',
          outcome: 'failure',
        },
        {
          probeClass: 'indexer',
          providerId: 'indexer-1',
          correlationGroup: 'indexer-cluster-a',
          outcome: 'uncertain',
        },
      ],
    })

    expect(result.verdict).toBe('suspect')
    expect(result.reason).toBe('runner-timeout-suspect')
  })

  it('is deterministic for identical tuples', () => {
    const input: BatchRunnerTimeoutSuspicionTask1Input = {
      ...baseInput,
      observations: [
        {
          probeClass: 'rpc',
          providerId: 'base-rpc-1',
          correlationGroup: 'public-rpc-cluster-a',
          outcome: 'failure',
        },
        {
          probeClass: 'tx-receipt',
          providerId: 'alt-rpc-1',
          correlationGroup: 'independent-rpc-cluster-b',
          outcome: 'failure',
        },
      ],
    }

    const a = evaluateBatchRunnerTimeoutSuspicionTask1(input)
    const b = evaluateBatchRunnerTimeoutSuspicionTask1(input)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
