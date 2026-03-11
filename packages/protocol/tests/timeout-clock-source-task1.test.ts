import { describe, expect, it } from 'bun:test'

import {
  evaluateTimeoutClockSourceTask1,
  type TimeoutClockSourceTask1Input,
} from '../src/timeout-clock-source-task1.ts'

describe('timeout clock source task1', () => {
  const baseInput: TimeoutClockSourceTask1Input = {
    expectedNodeId: 'runner-1',
    observations: [
      {
        nodeId: 'runner-1',
        sourceClass: 'monotonic',
        provenanceValid: true,
        monotonicTick: 100,
        wallClockUnixMs: 1773192350000,
      },
      {
        nodeId: 'runner-1',
        sourceClass: 'monotonic',
        provenanceValid: true,
        monotonicTick: 101,
        wallClockUnixMs: 1773192350500,
      },
    ],
  }

  it('fails when monotonic stream provenance is invalid', () => {
    const result = evaluateTimeoutClockSourceTask1({
      ...baseInput,
      observations: [
        {
          ...baseInput.observations[0],
          provenanceValid: false,
        },
        baseInput.observations[1],
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-clock-source-provenance-invalid')
    expect(result.invalidProvenanceIndexes).toEqual([0])
  })

  it('fails when mixed source ordering appears in one tuple', () => {
    const result = evaluateTimeoutClockSourceTask1({
      ...baseInput,
      observations: [
        baseInput.observations[0],
        {
          ...baseInput.observations[1],
          sourceClass: 'wall-clock',
        },
      ],
    })

    expect(result.verdict).toBe('fail')
    expect(result.reason).toBe('timeout-clock-source-mixed-ordering-invalid')
    expect(result.mixedSourceOrdering).toBe(true)
  })

  it('passes for same-source monotonic traces with valid provenance', () => {
    const result = evaluateTimeoutClockSourceTask1(baseInput)

    expect(result.verdict).toBe('pass')
    expect(result.reason).toBe('timeout-clock-source-pass')
    expect(result.invalidProvenanceIndexes).toEqual([])
    expect(result.mixedSourceOrdering).toBe(false)
  })

  it('is deterministic for identical tuples', () => {
    const a = evaluateTimeoutClockSourceTask1(baseInput)
    const b = evaluateTimeoutClockSourceTask1(baseInput)

    expect(a).toEqual(b)
    expect(a.artifactHash).toBe(b.artifactHash)
  })
})
