/**
 * Scenario 10: Stakes & Elo — rated stakes, Elo updates, protocol fees
 */
import {
  runTest, setupBattle, submitTurn, mineBlocks, getBattleState,
  getAgentProfile, walletA, walletB, publicClient, ARENA,
  assertEqual, assert, type TestResult,
} from '../harness'
import { clawttackArenaAbi, clawttackBattleAbi } from '../../../packages/abi/abi'
import { parseEther } from 'viem'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('zero stake battle — Elo unchanged', async () => {
    const ctx = await setupBattle({ stake: 0n })

    // Play 2 turns then timeout
    await submitTurn(ctx)
    await submitTurn(ctx)
    await mineBlocks(90)

    const state = await getBattleState(ctx.BATTLE)
    const expectedA = (state.currentTurn % 2 === 0) ? ctx.firstMoverA : !ctx.firstMoverA
    const claimWallet = expectedA ? walletB : walletA
    await claimWallet.writeContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
    })

    // Elo should remain at 1500 (unrated)
    const profileA = await getAgentProfile(ctx.agentIdA)
    const profileB = await getAgentProfile(ctx.agentIdB)
    assertEqual(profileA.eloRating, 1500, 'Agent A Elo unchanged')
    assertEqual(profileB.eloRating, 1500, 'Agent B Elo unchanged')
  }))

  results.push(await runTest('rated stake (0.001 ETH) — Elo updates', async () => {
    const stake = parseEther('0.001')
    const ctx = await setupBattle({ stake })

    // Play 2 turns then timeout
    await submitTurn(ctx)
    await submitTurn(ctx)
    await mineBlocks(90)

    const state = await getBattleState(ctx.BATTLE)
    const expectedA = (state.currentTurn % 2 === 0) ? ctx.firstMoverA : !ctx.firstMoverA
    const claimWallet = expectedA ? walletB : walletA
    const tx = await claimWallet.writeContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'claimTimeoutWin',
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })

    // Elo should have changed from 1500
    const profileA = await getAgentProfile(ctx.agentIdA)
    const profileB = await getAgentProfile(ctx.agentIdB)
    assert(
      profileA.eloRating !== 1500 || profileB.eloRating !== 1500,
      'At least one Elo changed',
    )
    // Winner's Elo should be higher
    const winnerProfile = (profileA.totalWins > 0) ? profileA : profileB
    const loserProfile = (profileA.totalWins > 0) ? profileB : profileA
    assert(winnerProfile.eloRating > loserProfile.eloRating, 'Winner Elo > Loser Elo')
  }))

  return results
}

export const localOnly = true
