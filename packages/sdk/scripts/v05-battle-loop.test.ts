import { describe, expect, test } from 'bun:test'

process.env.CLAWTTACK_SKIP_MAIN = '1'
process.env.CLAWTTACK_BATTLE = process.env.CLAWTTACK_BATTLE || '0x1111111111111111111111111111111111111111'
process.env.CLAWTTACK_OPPONENT_PRIVATE_KEY = process.env.CLAWTTACK_OPPONENT_PRIVATE_KEY || '0x' + '11'.repeat(32)

const mod = await import('./v05-battle-loop.ts')

describe('v05 run-context sidecar', () => {
  test('defaults to indeterminate observation states and stable battle address', () => {
    const sidecar = mod.defaultRunContextSidecar()
    expect(sidecar.acceptedOnChain).toBe('indeterminate')
    expect(sidecar.terminalOnChain).toBe('indeterminate')
    expect(sidecar.battleAddress).toBe(process.env.CLAWTTACK_BATTLE!.toLowerCase())
    expect(sidecar.lastUpdateSource).toBe('uninitialized')
  })

  test('rejects battle identity drift once bound', () => {
    const base = mod.updateRunContextSidecar(
      mod.defaultRunContextSidecar(),
      { battleId: 7 },
      'test-bind',
    )

    expect(() => mod.updateRunContextSidecar(base, { battleId: 8 }, 'test-mismatch-id')).toThrow(
      /battleId mismatch/,
    )
    expect(() => mod.updateRunContextSidecar(base, { battleAddress: '0x2222222222222222222222222222222222222222' }, 'test-mismatch-address')).toThrow(
      /battleAddress mismatch/,
    )
  })
})
