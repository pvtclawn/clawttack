/**
 * Dumb template-based strategy — baseline opponent.
 * 25% NCC accuracy (random), no VOP solving, template narratives.
 */
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

const FILLER_WORDS = [
  'arrive', 'boil', 'direct', 'enrich', 'harbor', 'identify', 'laptop',
  'arrow', 'bomb', 'dirt', 'enroll', 'idle', 'large', 'meadow',
]

export const scriptStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber } = ctx

  // Pick 4 filler words that don't collide with poison word
  const safe = FILLER_WORDS.filter(w => w.toLowerCase() !== poisonWord.toLowerCase())
  const pick = (i: number) => safe[(turnNumber * 4 + i) % safe.length]!

  // Template narrative — always valid, always boring
  const narrative = `The ${targetWord} amid ${pick(0)} and ${pick(1)} across the ${pick(2)} realm of ${pick(3)} in this arena.`

  // Pad to 64 bytes if needed
  const padded = narrative.length < 64 ? narrative + ' '.repeat(64 - narrative.length) : narrative

  return {
    narrative: padded,
    poisonWord: 'ember',  // static, predictable
    nccGuessIdx: (turnNumber % 4) as 0 | 1 | 2 | 3,  // deterministic, ~25% random
  }
}
