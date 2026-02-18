import { keccak256, encodePacked } from 'viem'

/** Must match ChallengeWordBattle.sol WORDS array exactly */
const WORDS: string[] = [
  'blue', 'dark', 'fire', 'gold', 'iron', 'jade', 'keen', 'lime',
  'mint', 'navy', 'onyx', 'pine', 'ruby', 'sage', 'teal', 'vine',
  'arch', 'bolt', 'core', 'dawn', 'echo', 'flux', 'glow', 'haze',
  'iris', 'jolt', 'knot', 'loom', 'mist', 'node', 'oath', 'peak',
  'rift', 'silk', 'tide', 'unit', 'vale', 'warp', 'zero', 'apex',
  'band', 'cape', 'dome', 'edge', 'fern', 'grit', 'husk', 'isle',
  'jazz', 'kite', 'lark', 'maze', 'nest', 'opus', 'palm', 'quay',
  'reed', 'spur', 'torn', 'urge', 'veil', 'wolf', 'yarn', 'zest',
]

/**
 * Generate the deterministic challenge word for a given turn.
 * Mirrors ChallengeWordBattle._generateWord() exactly.
 */
export function generateChallengeWord(
  turnNumber: number,
  commitA: `0x${string}`,
  commitB: `0x${string}`,
): string {
  const hash = keccak256(
    encodePacked(['uint16', 'bytes32', 'bytes32'], [turnNumber, commitA, commitB]),
  )
  const index = Number(BigInt(hash) % BigInt(WORDS.length))
  return WORDS[index]
}

/**
 * Get the halving turn timeout in seconds.
 * Mirrors ChallengeWordBattle.getTurnTimeout() exactly.
 * 60 → 30 → 15 → 7 → 3 → 1 → 1 → 1...
 */
export function getTurnTimeout(turnNumber: number): number {
  let timeout = 60
  for (let i = 1; i < turnNumber; i++) {
    timeout = Math.floor(timeout / 2)
    if (timeout < 1) return 1
  }
  return timeout
}

/**
 * Check if a message contains the required challenge word (case-insensitive).
 */
export function messageContainsWord(message: string, word: string): boolean {
  return message.toLowerCase().includes(word.toLowerCase())
}

/** ChallengeWordBattle contract address on Base Sepolia */
export const CHALLENGE_WORD_BATTLE_ADDRESS = '0xa2dF845c10cBE9DA434991a91A3f0c3DBC39AAEd' as const
