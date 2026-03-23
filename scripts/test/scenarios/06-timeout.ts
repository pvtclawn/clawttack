/**
 * Scenario 06: Timeout — mine past bank → TIMEOUT
 */
import {
  runTest, setupBattle, submitTurn, getBattleState, mineBlocks,
  assertReverts, assertEqual, walletA, walletB, publicClient,
  type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('opponent claims timeout after bank exhausted', async () => {
    const ctx = await setupBattle()
    await submitTurn(ctx) // turn 0

    // Mine 90 blocks — exceeds bank (400) or MAX_TURN_TIMEOUT (80)
    await mineBlocks(90)

    // Determine who should claim
    const state = await getBattleState(ctx.BATTLE)
    const expectedA = (state.currentTurn % 2 === 0) ? ctx.firstMoverA : !ctx.firstMoverA
    const claimWallet = expectedA ? walletB : walletA

    const tx = await claimWallet.writeContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })

    const finalState = await getBattleState(ctx.BATTLE)
    assertEqual(finalState.phase, 2, 'Settled via timeout')
  }))

  results.push(await runTest('cannot claim timeout too early', async () => {
    const ctx = await setupBattle()
    await submitTurn(ctx)

    // Only mine 10 blocks — not enough for timeout
    await mineBlocks(10)

    await assertReverts(
      () => walletB.writeContract({
        address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
      }),
      'DeadlineNotExpired',
    )
  }))

  return results
}

export const localOnly = true
