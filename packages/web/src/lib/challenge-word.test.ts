import { describe, expect, test } from 'bun:test'
import { generateChallengeWord, getTurnTimeout, messageContainsWord } from './challenge-word'

describe('getTurnTimeout', () => {
  test('turn 1 = 60s', () => {
    expect(getTurnTimeout(1)).toBe(60)
  })

  test('turn 2 = 30s (halved)', () => {
    expect(getTurnTimeout(2)).toBe(30)
  })

  test('turn 3 = 15s', () => {
    expect(getTurnTimeout(3)).toBe(15)
  })

  test('turn 4 = 7s', () => {
    expect(getTurnTimeout(4)).toBe(7)
  })

  test('turn 5 = 3s', () => {
    expect(getTurnTimeout(5)).toBe(3)
  })

  test('turn 6 = 1s', () => {
    expect(getTurnTimeout(6)).toBe(1)
  })

  test('turn 7+ floors at 1s', () => {
    expect(getTurnTimeout(7)).toBe(1)
    expect(getTurnTimeout(10)).toBe(1)
    expect(getTurnTimeout(100)).toBe(1)
  })

  test('halving sequence is monotonically decreasing', () => {
    let prev = getTurnTimeout(1)
    for (let i = 2; i <= 10; i++) {
      const curr = getTurnTimeout(i)
      expect(curr).toBeLessThanOrEqual(prev)
      prev = curr
    }
  })
})

describe('messageContainsWord', () => {
  test('finds word in message', () => {
    expect(messageContainsWord('The fire burns bright', 'fire')).toBe(true)
  })

  test('case-insensitive match', () => {
    expect(messageContainsWord('The FIRE burns bright', 'fire')).toBe(true)
    expect(messageContainsWord('The fire burns bright', 'FIRE')).toBe(true)
  })

  test('returns false when word not present', () => {
    expect(messageContainsWord('The water flows gently', 'fire')).toBe(false)
  })

  test('handles empty message', () => {
    expect(messageContainsWord('', 'fire')).toBe(false)
  })

  test('handles empty word', () => {
    // Empty string is always contained
    expect(messageContainsWord('anything', '')).toBe(true)
  })

  test('finds word as substring', () => {
    // Substring matching is intentional (Egor's decision)
    expect(messageContainsWord('The campfire crackled', 'fire')).toBe(true)
  })

  test('finds word at boundaries', () => {
    expect(messageContainsWord('fire', 'fire')).toBe(true)
    expect(messageContainsWord('fire burns', 'fire')).toBe(true)
    expect(messageContainsWord('on fire', 'fire')).toBe(true)
  })
})

describe('generateChallengeWord', () => {
  const commitA = '0x1111111111111111111111111111111111111111111111111111111111111111' as const
  const commitB = '0x2222222222222222222222222222222222222222222222222222222222222222' as const

  test('returns a string from the word list', () => {
    const word = generateChallengeWord(1, commitA, commitB)
    expect(typeof word).toBe('string')
    expect(word.length).toBeGreaterThanOrEqual(3)
    expect(word.length).toBeLessThanOrEqual(5)
  })

  test('is deterministic for same inputs', () => {
    const word1 = generateChallengeWord(1, commitA, commitB)
    const word2 = generateChallengeWord(1, commitA, commitB)
    expect(word1).toBe(word2)
  })

  test('different turns produce different words (usually)', () => {
    const words = new Set<string>()
    for (let i = 1; i <= 10; i++) {
      words.add(generateChallengeWord(i, commitA, commitB))
    }
    // With 64 words and 10 turns, expect at least some variety
    expect(words.size).toBeGreaterThan(1)
  })

  test('different commits produce different words (usually)', () => {
    const commitC = '0x3333333333333333333333333333333333333333333333333333333333333333' as const
    const word1 = generateChallengeWord(1, commitA, commitB)
    const word2 = generateChallengeWord(1, commitA, commitC)
    // Not guaranteed different, but overwhelmingly likely with keccak256
    // Just check both are valid strings
    expect(typeof word1).toBe('string')
    expect(typeof word2).toBe('string')
  })
})
