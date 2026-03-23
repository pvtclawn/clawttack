/**
 * Scenario 12: Edge Cases & Guards
 */
import {
  runTest, setupBattle, submitTurn, mineBlocks, assertReverts,
  walletA, walletB, walletC, publicClient, ARENA, registerAgent,
  createBattle, type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('wrong player turn reverts UnauthorizedTurn', async () => {
    const ctx = await setupBattle()
    // First mover is determined by contract — try the wrong wallet
    const wrongWallet = ctx.firstMoverA ? walletB : walletA
    await mineBlocks(6)

    await assertReverts(
      () => wrongWallet.writeContract({
        address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'submitTurn',
        args: [{
          narrative: 'test', customPoisonWord: 'test',
          nccAttack: { candidateWordIndices: [0, 0, 0, 0], candidateOffsets: [0, 0, 0, 0], nccCommitment: '0x0000000000000000000000000000000000000000000000000000000000000001' },
          nccDefense: { guessIdx: 0 },
          nccReveal: { salt: '0x0000000000000000000000000000000000000000000000000000000000000000', intendedIdx: 0 },
          vopCommit: { vopCommitment: '0x0000000000000000000000000000000000000000000000000000000000000001', instanceCommit: '0x0000000000000000000000000000000000000000000000000000000000000000' },
          vopSolve: { vopClaimedIndex: 0, solution: '0x' },
          vopReveal: { vopSalt: '0x0000000000000000000000000000000000000000000000000000000000000000', vopIndex: 0 },
        }],
      }),
      'UnauthorizedTurn',
    )
  }))

  results.push(await runTest('non-participant submitTurn reverts', async () => {
    const ctx = await setupBattle()
    await mineBlocks(6)

    await assertReverts(
      () => walletC.writeContract({
        address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'submitTurn',
        args: [{
          narrative: 'test', customPoisonWord: 'test',
          nccAttack: { candidateWordIndices: [0, 0, 0, 0], candidateOffsets: [0, 0, 0, 0], nccCommitment: '0x0000000000000000000000000000000000000000000000000000000000000001' },
          nccDefense: { guessIdx: 0 },
          nccReveal: { salt: '0x0000000000000000000000000000000000000000000000000000000000000000', intendedIdx: 0 },
          vopCommit: { vopCommitment: '0x0000000000000000000000000000000000000000000000000000000000000001', instanceCommit: '0x0000000000000000000000000000000000000000000000000000000000000000' },
          vopSolve: { vopClaimedIndex: 0, solution: '0x' },
          vopReveal: { vopSalt: '0x0000000000000000000000000000000000000000000000000000000000000000', vopIndex: 0 },
        }],
      }),
      'NotParticipant',
    )
  }))

  results.push(await runTest('turn too fast reverts TurnTooFast', async () => {
    const ctx = await setupBattle()
    // Submit first turn normally
    await submitTurn(ctx)
    // Try second turn with only 2 blocks mined (less than MIN_TURN_INTERVAL=5)
    await assertReverts(
      () => submitTurn(ctx, { blocksBeforeTurn: 2 }),
      'TurnTooFast',
    )
  }))

  return results
}

export const localOnly = true
