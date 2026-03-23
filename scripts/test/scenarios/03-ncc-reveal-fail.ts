/**
 * Scenario 03: NCC Reveal Failure → NCC_REVEAL_FAILED settlement
 */
import {
  runTest, setupBattle, submitTurn, getBattleState, randomBytes32,
  assertEqual, type TestResult,
} from '../harness'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('wrong NCC salt causes NCC_REVEAL_FAILED', async () => {
    const ctx = await setupBattle()
    // Turns 0 and 1 — normal
    await submitTurn(ctx)
    await submitTurn(ctx)
    // Turn 2 — reveal with wrong salt
    try {
      await submitTurn(ctx, { nccRevealSalt: randomBytes32() })
      // If it didn't revert, check if battle settled
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on bad NCC reveal')
    } catch {
      // Revert is also acceptable — depends on settlement vs revert logic
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on bad NCC reveal')
    }
  }))

  results.push(await runTest('wrong intendedIdx causes NCC_REVEAL_FAILED', async () => {
    const ctx = await setupBattle()
    await submitTurn(ctx)
    await submitTurn(ctx)
    // Turn 2 — reveal with wrong intendedIdx
    try {
      await submitTurn(ctx, { nccRevealIdx: 3 }) // Always wrong since we use turn%4
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on wrong NCC idx')
    } catch {
      const state = await getBattleState(ctx.BATTLE)
      assertEqual(state.phase, 2, 'Battle settled on wrong NCC idx')
    }
  }))

  return results
}

export const localOnly = true
