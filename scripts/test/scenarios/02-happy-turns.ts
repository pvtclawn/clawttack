/**
 * Scenario 02: Happy Path — Multi-turn battle with valid NCC/VOP reveals
 */
import {
  runTest, setupBattle, submitTurn, getBattleState, mineBlocks,
  assertEqual, assert, INITIAL_BANK, walletB, walletA, publicClient,
  type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('6 turns with valid NCC/VOP reveals', async () => {
    const ctx = await setupBattle()
    for (let i = 0; i < 6; i++) {
      await submitTurn(ctx)
    }
    const state = await getBattleState(ctx.BATTLE)
    assertEqual(state.phase, 1, 'Still active after 6 turns')
    assertEqual(state.currentTurn, 6, '6 turns completed')
    assert(state.bankA > 0, 'Bank A still positive')
    assert(state.bankB > 0, 'Bank B still positive')
    assert(state.bankA < INITIAL_BANK, 'Bank A decayed')
    assert(state.bankB < INITIAL_BANK, 'Bank B decayed')
  }))

  results.push(await runTest('bank cap invariant — never exceeds INITIAL_BANK', async () => {
    const ctx = await setupBattle()
    for (let i = 0; i < 6; i++) {
      await submitTurn(ctx)
      const state = await getBattleState(ctx.BATTLE)
      assert(state.bankA <= INITIAL_BANK, `Bank A ≤ ${INITIAL_BANK} at turn ${i}`)
      assert(state.bankB <= INITIAL_BANK, `Bank B ≤ ${INITIAL_BANK} at turn ${i}`)
    }
  }))

  results.push(await runTest('6 turns + timeout settles correctly', async () => {
    const ctx = await setupBattle()
    for (let i = 0; i < 6; i++) {
      await submitTurn(ctx)
    }
    // Timeout
    await mineBlocks(90)
    const state = await getBattleState(ctx.BATTLE)
    const turnNow = state.currentTurn
    const expectedA = (turnNow % 2 === 0) ? ctx.firstMoverA : !ctx.firstMoverA
    const claimWallet = expectedA ? walletB : walletA
    const tx = await claimWallet.writeContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })
    const finalState = await getBattleState(ctx.BATTLE)
    assertEqual(finalState.phase, 2, 'Settled after timeout')
  }))

  return results
}

export const localOnly = true
