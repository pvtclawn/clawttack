/**
 * Scenario 08: Joker Narratives — 257-1024 byte narratives
 */
import {
  runTest, setupBattle, submitTurn, getJokersRemaining, getBattleState,
  assertReverts, assertEqual, assert, getWord, publicClient,
  type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'

/** Build a long narrative containing the target word and candidates */
async function buildLongNarrative(
  battle: `0x${string}`,
  targetLen: number,
  candidates: [number, number, number, number],
): Promise<string> {
  const targetWordIndex = await publicClient.readContract({
    address: battle, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
  }) as number
  const targetWord = await getWord(targetWordIndex)
  const words = await Promise.all(candidates.map(i => getWord(i)))

  let narrative = `The ${targetWord} amid ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]}.`
  // Pad to target length with safe filler
  while (Buffer.byteLength(narrative) < targetLen) {
    narrative += ' The saga continues with valor and might in endless battle.'
  }
  // Trim to exact length
  if (Buffer.byteLength(narrative) > targetLen) {
    narrative = narrative.slice(0, targetLen)
  }
  return narrative
}

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('257-byte joker narrative succeeds + decrements joker', async () => {
    const ctx = await setupBattle()

    const jokersBefore = await getJokersRemaining(ctx.BATTLE)
    const firstMoverIsA = ctx.firstMoverA
    const relevantBefore = firstMoverIsA ? jokersBefore.a : jokersBefore.b

    // Build 257-byte narrative (just over MAX_NARRATIVE_LEN=256)
    const candidates: [number, number, number, number] = [100, 200, 300, 400]
    const longNarrative = await buildLongNarrative(ctx.BATTLE, 257, candidates)

    await submitTurn(ctx, { customNarrative: longNarrative, candidateIndices: candidates })

    const jokersAfter = await getJokersRemaining(ctx.BATTLE)
    const relevantAfter = firstMoverIsA ? jokersAfter.a : jokersAfter.b
    assertEqual(relevantAfter, relevantBefore - 1, 'Joker decremented')
  }))

  results.push(await runTest('1024-byte max joker narrative succeeds', async () => {
    const ctx = await setupBattle()

    const candidates: [number, number, number, number] = [100, 200, 300, 400]
    const longNarrative = await buildLongNarrative(ctx.BATTLE, 1024, candidates)
    
    await submitTurn(ctx, { customNarrative: longNarrative, candidateIndices: candidates })

    const state = await getBattleState(ctx.BATTLE)
    assertEqual(state.phase, 1, 'Battle still active after 1024-byte narrative')
  }))

  results.push(await runTest('exceed maxJokers (0) reverts NoJokersRemaining', async () => {
    // maxJokers is now a global GameConfig param, so this test no longer applies
    // Skip: would need admin to set gameConfig.maxJokers = 0 first
    const ctx = await setupBattle()

    const candidates: [number, number, number, number] = [100, 200, 300, 400]
    const longNarrative = await buildLongNarrative(ctx.BATTLE, 257, candidates)

    await assertReverts(
      () => submitTurn(ctx, { customNarrative: longNarrative, candidateIndices: candidates }),
      'NoJokersRemaining',
    )
  }))

  return results
}

export const localOnly = true
