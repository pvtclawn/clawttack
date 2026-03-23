/**
 * Scenario 01: Battle Lifecycle
 * Tests: register, create, accept, cancel
 */
import {
  runTest, setupBattle, registerAgent, createBattle, acceptBattle,
  walletA, walletB, publicClient, ARENA, assertPhase, assertReverts,
  assertEqual, getAgentProfile, type TestResult,
} from '../harness'
import { clawttackArenaAbi, clawttackBattleAbi } from '../../../packages/abi/abi'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('register agent assigns sequential ID + default Elo', async () => {
    const id1 = await registerAgent(walletA)
    const id2 = await registerAgent(walletB)
    assertEqual(Number(id2), Number(id1) + 1, 'Sequential IDs')
    const profile = await getAgentProfile(id1)
    assertEqual(profile.eloRating, 1500, 'Default Elo')
    assertEqual(profile.totalWins, 0, 'Zero wins')
    assertEqual(profile.totalLosses, 0, 'Zero losses')
  }))

  results.push(await runTest('create battle increments battlesCount', async () => {
    const agentId = await registerAgent(walletA)
    const countBefore = await publicClient.readContract({
      address: ARENA, abi: clawttackArenaAbi, functionName: 'battlesCount',
    }) as bigint
    await createBattle(walletA, agentId, { targetAgentId: 0n })
    const countAfter = await publicClient.readContract({
      address: ARENA, abi: clawttackArenaAbi, functionName: 'battlesCount',
    }) as bigint
    assertEqual(Number(countAfter), Number(countBefore) + 1, 'battlesCount')
  }))

  results.push(await runTest('accept battle sets phase to Active', async () => {
    const ctx = await setupBattle()
    await assertPhase(ctx.BATTLE, 1, 'Active after accept')
  }))

  results.push(await runTest('cancel open battle refunds and sets Cancelled', async () => {
    const agentId = await registerAgent(walletA)
    const { battleAddr } = await createBattle(walletA, agentId)
    await assertPhase(battleAddr, 0, 'Open phase')

    const tx = await walletA.writeContract({
      address: battleAddr, abi: clawttackBattleAbi, functionName: 'cancelBattle',
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })
    await assertPhase(battleAddr, 3, 'Cancelled phase')
  }))

  results.push(await runTest('cannot cancel after accept', async () => {
    const ctx = await setupBattle()
    await assertReverts(
      () => walletA.writeContract({
        address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'cancelBattle',
      }),
      'BattleNotCancellable',
    )
  }))

  return results
}

export const localOnly = true
