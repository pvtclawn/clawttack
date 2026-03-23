/**
 * Scenario 07: Capture The Flag — both captureFlag overloads → COMPROMISE
 */
import {
  runTest, setupBattle, getBattleState, assertReverts,
  walletA, walletB, walletC, publicClient, ACCOUNTS, assertEqual,
  type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'
import { keccak256, encodeAbiParameters, parseAbiParameters, hashMessage } from 'viem'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('captureFlag() self-call — caller loses', async () => {
    const ctx = await setupBattle()

    // Player A calls captureFlag() — A is the victim, B wins
    const tx = await walletA.writeContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'captureFlag',
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })

    const state = await getBattleState(ctx.BATTLE)
    assertEqual(state.phase, 2, 'Settled via flag capture')
  }))

  results.push(await runTest('captureFlag(signature) ECDSA compromise', async () => {
    const ctx = await setupBattle()

    // Player A captures B's flag by submitting B's signature
    // Message: keccak256(abi.encode(chainId, battleAddress, battleId, "COMPROMISE"))
    const chainId = 31337n // foundry chain
    const messageHash = keccak256(encodeAbiParameters(
      parseAbiParameters('uint256, address, uint256, string'),
      [chainId, ctx.BATTLE, ctx.battleId, 'COMPROMISE']
    ))
    // Sign as B (the victim) — in real attack, A somehow extracted B's key
    const signature = await ACCOUNTS.B.signMessage({ message: { raw: messageHash } })

    const tx = await walletA.writeContract({
      address: ctx.BATTLE,
      abi: clawttackBattleAbi,
      functionName: 'captureFlag',
      args: [signature],
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })

    const state = await getBattleState(ctx.BATTLE)
    assertEqual(state.phase, 2, 'Settled via ECDSA compromise')
  }))

  results.push(await runTest('captureFlag with invalid signature reverts', async () => {
    const ctx = await setupBattle()

    // Sign with wrong message
    const bogusSignature = await ACCOUNTS.A.signMessage({ message: 'bogus' })

    await assertReverts(
      () => walletA.writeContract({
        address: ctx.BATTLE,
        abi: clawttackBattleAbi,
        functionName: 'captureFlag',
        args: [bogusSignature],
      }),
      'InvalidCompromiseSignature',
    )
  }))

  results.push(await runTest('captureFlag by non-participant reverts', async () => {
    const ctx = await setupBattle()

    await assertReverts(
      () => walletC.writeContract({
        address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'captureFlag',
      }),
      'NotParticipant',
    )
  }))

  return results
}

export const localOnly = true
