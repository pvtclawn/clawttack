/**
 * Scenario 13: Narrative Validation — length, ASCII, boundaries
 */
import {
  runTest, setupBattle, submitTurn, assertReverts, getWord, publicClient,
  type TestResult,
} from '../harness'
import { clawttackBattleAbi } from '../../../packages/abi/abi'

export default async function(): Promise<TestResult[]> {
  const results: TestResult[] = []

  results.push(await runTest('narrative <64 bytes reverts NarrativeTooShort', async () => {
    const ctx = await setupBattle()

    // Build a too-short narrative
    const targetWordIndex = await publicClient.readContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    }) as number
    const targetWord = await getWord(targetWordIndex)

    const shortNarrative = `The ${targetWord} here now.` // way less than 64 bytes

    await assertReverts(
      () => submitTurn(ctx, {
        customNarrative: shortNarrative,
        candidateIndices: [100, 200, 300, 400],
      }),
      'NarrativeTooShort',
    )
  }))

  results.push(await runTest('narrative >1024 bytes reverts NarrativeTooLong', async () => {
    const ctx = await setupBattle()

    const targetWordIndex = await publicClient.readContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    }) as number
    const targetWord = await getWord(targetWordIndex)
    const words = await Promise.all([100, 200, 300, 400].map(i => getWord(i)))

    let tooLong = `The ${targetWord} amid ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]}.`
    while (Buffer.byteLength(tooLong) < 1025) {
      tooLong += ' The epic saga of battles and warriors continues forever and ever onward.'
    }

    await assertReverts(
      () => submitTurn(ctx, {
        customNarrative: tooLong,
        candidateIndices: [100, 200, 300, 400],
      }),
      'NarrativeTooLong',
    )
  }))

  results.push(await runTest('narrative with non-ASCII reverts InvalidASCII', async () => {
    const ctx = await setupBattle()

    const targetWordIndex = await publicClient.readContract({
      address: ctx.BATTLE, abi: clawttackBattleAbi, functionName: 'targetWordIndex',
    }) as number
    const targetWord = await getWord(targetWordIndex)
    const words = await Promise.all([100, 200, 300, 400].map(i => getWord(i)))

    // Include a non-ASCII character (é = 0xC3 0xA9)
    let badNarrative = `The ${targetWord} amid ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]} café battle.`
    while (Buffer.byteLength(badNarrative) < 64) badNarrative += ' Fight.'

    await assertReverts(
      () => submitTurn(ctx, {
        customNarrative: badNarrative,
        candidateIndices: [100, 200, 300, 400],
      }),
      'InvalidASCII',
    )
  }))

  results.push(await runTest('target word missing reverts TargetWordMissing', async () => {
    const ctx = await setupBattle()

    const words = await Promise.all([100, 200, 300, 400].map(i => getWord(i)))

    // Narrative without the target word
    let noTargetNarrative = `Battle scene with ${words[0]} and ${words[1]} across the ${words[2]} realm of ${words[3]} in arena.`
    while (Buffer.byteLength(noTargetNarrative) < 64) noTargetNarrative += ' Continue.'

    await assertReverts(
      () => submitTurn(ctx, {
        customNarrative: noTargetNarrative,
        candidateIndices: [100, 200, 300, 400],
      }),
      'TargetWordMissing',
    )
  }))

  results.push(await runTest('duplicate candidate indices reverts DuplicateCandidate', async () => {
    const ctx = await setupBattle()

    await assertReverts(
      () => submitTurn(ctx, {
        candidateIndices: [100, 100, 300, 400], // duplicate 100
      }),
      'DuplicateCandidate',
    )
  }))

  return results
}

export const localOnly = true
