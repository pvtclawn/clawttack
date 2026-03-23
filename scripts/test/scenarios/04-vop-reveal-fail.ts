/**
 * Scenario 04: VOP Reveal Failure → VOP_REVEAL_FAILED settlement
 */
import {
  runTest, setupBattle, submitTurn, getBattleState, randomBytes32,
  assertEqual, type TestResult,
} from '../harness'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('wrong VOP salt causes VOP_REVEAL_FAILED', async () => {
    const ctx = await setupBattle()
    await submitTurn(ctx)
    await submitTurn(ctx)
    // Turn 2 — provide correct NCC reveal but wrong VOP salt
    try {
      await submitTurn(ctx, { vopRevealSalt: randomBytes32() })
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on bad VOP reveal')
    } catch {
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on bad VOP reveal')
    }
  }))

  results.push(await runTest('wrong VOP index in reveal causes VOP_REVEAL_FAILED', async () => {
    const ctx = await setupBattle()
    await submitTurn(ctx)
    await submitTurn(ctx)
    // Turn 2 — correct NCC reveal, wrong VOP index
    try {
      await submitTurn(ctx, { vopRevealIdx: 99 }) // bogus index
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on wrong VOP idx')
    } catch {
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on wrong VOP idx')
    }
  }))

  return results
}

export const localOnly = true
