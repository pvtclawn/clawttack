import { describe, expect, it } from 'bun:test'
import {
  buildFailureMatrixRunContext,
  computeFailureMatrixReplayHash,
  runFailureMatrixTask1,
  type FailureMatrixFixture,
  type FailureMatrixTask1Config,
} from '../src/failure-injection-matrix'

const CONFIG: FailureMatrixTask1Config = {
  seed: 'seed-42',
  schemaVersion: 'v1',
  configVersion: 'cfg-2026-03-09',
  moduleSet: ['replay-envelope', 'dual-clock-timeout'],
}

const mkFixture = (overrides?: Partial<FailureMatrixFixture>): FailureMatrixFixture => ({
  fixtureId: 'fixture-delay-1',
  moduleName: 'replay-envelope',
  failureClass: 'delay',
  visibility: 'public',
  input: { envelope: { turn: 5 }, state: { turn: 4 } },
  ...overrides,
})

describe('failure-injection matrix task-1', () => {
  it('reports hidden/public results separately', () => {
    const fixtures: FailureMatrixFixture[] = [
      mkFixture({ fixtureId: 'pub-pass', visibility: 'public' }),
      mkFixture({ fixtureId: 'pub-fail', visibility: 'public', failureClass: 'stale' }),
      mkFixture({ fixtureId: 'hid-pass', visibility: 'hidden', moduleName: 'dual-clock-timeout' }),
      mkFixture({ fixtureId: 'hid-fail', visibility: 'hidden', failureClass: 'omit' }),
    ]

    const report = runFailureMatrixTask1(fixtures, CONFIG, (fixture) => fixture.fixtureId.endsWith('pass'))

    expect(report.total).toBe(4)
    expect(report.public).toEqual({ count: 2, passed: 1, failed: 1 })
    expect(report.hidden).toEqual({ count: 2, passed: 1, failed: 1 })
  })

  it('replay hash changes when context metadata changes even for same input', () => {
    const fixture = mkFixture()

    const contextA = buildFailureMatrixRunContext(CONFIG, fixture)
    const contextB = buildFailureMatrixRunContext(
      {
        ...CONFIG,
        seed: 'seed-99',
      },
      fixture,
    )

    const hashA = computeFailureMatrixReplayHash(contextA, fixture.input)
    const hashB = computeFailureMatrixReplayHash(contextB, fixture.input)

    expect(hashA).not.toBe(hashB)
  })

  it('replay hash is deterministic for identical context + fixture input', () => {
    const fixture = mkFixture()
    const context = buildFailureMatrixRunContext(CONFIG, fixture)

    const a = computeFailureMatrixReplayHash(context, fixture.input)
    const b = computeFailureMatrixReplayHash(context, fixture.input)

    expect(a).toBe(b)
  })

  it('fails closed on incomplete run context', () => {
    const fixture = mkFixture()

    expect(() =>
      buildFailureMatrixRunContext(
        {
          ...CONFIG,
          schemaVersion: '',
        },
        fixture,
      ),
    ).toThrow('incomplete-run-context:schemaVersion')

    expect(() =>
      buildFailureMatrixRunContext(
        {
          ...CONFIG,
          moduleSet: [],
        },
        fixture,
      ),
    ).toThrow('incomplete-run-context:moduleSet')
  })
})
