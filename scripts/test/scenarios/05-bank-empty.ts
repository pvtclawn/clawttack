/**
 * Scenario 05: Bank Empty — drain bank via slow play → BANK_EMPTY
 */
import {
  runTest, setupBattle, submitTurn, getBattleState, mineBlocks,
  assertEqual, assert, INITIAL_BANK, type TestResult,
} from '../harness'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('slow play drains bank to zero → BANK_EMPTY', async () => {
    const ctx = await setupBattle()
    // Each turn mines ~50 blocks — should drain bank fast
    // Bank starts at 400, each turn costs ~50 elapsed + 2% decay
    let settled = false
    for (let i = 0; i < 20 && !settled; i++) {
      try {
        await submitTurn(ctx, { blocksBeforeTurn: 50 })
        const state = await getBattleState(ctx.BATTLE)
        if (state.phase === 2) settled = true
      } catch {
        settled = true
      }
    }
    const state = await getBattleState(ctx.BATTLE)
    assertEqual(state.phase, 2, 'Battle settled via bank depletion')
    assert(state.bankA === 0 || state.bankB === 0, 'At least one bank is 0')
  }))

  return results
}

export const localOnly = true
