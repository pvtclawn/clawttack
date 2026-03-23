/**
 * Scenario 11: Poison Word Violations
 */
import {
  runTest, setupBattle, submitTurn, assertReverts, getWord,
  publicClient, type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('poison word too short (<4 chars) reverts', async () => {
    const ctx = await setupBattle()
    await assertReverts(
      () => submitTurn(ctx, { customPoisonWord: 'abc' }),
      'InvalidPoisonWord',
    )
  }))

  results.push(await runTest('poison word too long (>32 chars) reverts', async () => {
    const ctx = await setupBattle()
    await assertReverts(
      () => submitTurn(ctx, { customPoisonWord: 'a'.repeat(33) }),
      'InvalidPoisonWord',
    )
  }))

  results.push(await runTest('narrative containing poison word reverts PoisonWordDetected', async () => {
    const ctx = await setupBattle()
    // First turn sets a poison word
    await submitTurn(ctx, { customPoisonWord: 'xylophone' })

    // Second turn: build narrative that contains 'xylophone'
    const targetWordIndex = await publicClient.readContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    }) as number
    const targetWord = await getWord(targetWordIndex)
    const words = await Promise.all([100, 200, 300, 400].map(i => getWord(i)))

    // Deliberately include the poison word
    const poisonNarrative = `The ${targetWord} amid ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]} playing xylophone here now absolutely.`

    await assertReverts(
      () => submitTurn(ctx, {
        customNarrative: poisonNarrative,
        candidateIndices: [100, 200, 300, 400],
      }),
      'PoisonWordDetected',
    )
  }))

  return results
}

export const localOnly = true
