import { describe, expect, test } from 'bun:test';
import { scanForBip39Words, BIP39_TEST_WORDS } from './bip39-scanner.ts';

describe('bip39-scanner', () => {
  const words = BIP39_TEST_WORDS;

  test('finds BIP39 words in narrative', () => {
    const narrative = 'the hero must abandon all ability and be able to act';
    const result = scanForBip39Words(narrative, words);

    expect(result.matches.length).toBeGreaterThanOrEqual(3);
    const found = result.matches.map(m => m.word);
    expect(found).toContain('abandon');
    expect(found).toContain('ability');
    expect(found).toContain('able');
    expect(found).toContain('act');
  });

  test('returns correct byte offsets', () => {
    const narrative = 'abandon the ability';
    const result = scanForBip39Words(narrative, words);

    const abandonMatch = result.matches.find(m => m.word === 'abandon');
    expect(abandonMatch).toBeDefined();
    expect(abandonMatch!.byteOffset).toBe(0);

    const abilityMatch = result.matches.find(m => m.word === 'ability');
    expect(abilityMatch).toBeDefined();
    expect(abilityMatch!.byteOffset).toBe(12); // "abandon the " = 12 bytes
  });

  test('case insensitive matching', () => {
    const narrative = 'ABANDON the Ability and be ABLE to ACT';
    const result = scanForBip39Words(narrative, words);

    const found = result.matches.map(m => m.word);
    expect(found).toContain('abandon');
    expect(found).toContain('ability');
    expect(found).toContain('able');
    expect(found).toContain('act');
  });

  test('excludes specified words', () => {
    const narrative = 'abandon the ability and be able to act';
    const result = scanForBip39Words(narrative, words, ['abandon', 'act']);

    const found = result.matches.map(m => m.word);
    expect(found).not.toContain('abandon');
    expect(found).not.toContain('act');
    expect(found).toContain('ability');
    expect(found).toContain('able');
  });

  test('picks 4 candidates when enough words exist', () => {
    const narrative = 'we must abandon our ability to be able and learn about the world above, to access the abstract and achieve acid acoustic goals and acquire things across the way to act';
    const result = scanForBip39Words(narrative, words);

    expect(result.candidates).not.toBeNull();
    expect(result.candidates!.length).toBe(4);

    // All candidates should be unique
    const uniqueWords = new Set(result.candidates!.map(c => c.word));
    expect(uniqueWords.size).toBe(4);
  });

  test('returns null candidates when < 4 words', () => {
    const narrative = 'abandon the ability to fly';
    const result = scanForBip39Words(narrative, words);

    // Only 2 BIP39 words → can't pick 4 candidates
    expect(result.candidates).toBeNull();
  });

  test('no matches in non-BIP39 text', () => {
    const narrative = 'the quick brown fox jumps over the lazy dog';
    const result = scanForBip39Words(narrative, words);

    expect(result.matches.length).toBe(0);
    expect(result.candidates).toBeNull();
  });

  test('handles empty narrative', () => {
    const result = scanForBip39Words('', words);
    expect(result.matches.length).toBe(0);
  });

  test('candidates spread across narrative', () => {
    const narrative = 'abandon here, then ability there, then able somewhere, then about this, then above that, then absent now, then absorb it, then abstract idea';
    const result = scanForBip39Words(narrative, words);

    expect(result.candidates).not.toBeNull();
    // Candidates should be from different positions
    const offsets = result.candidates!.map(c => c.byteOffset);
    // Not all from the beginning
    expect(offsets[offsets.length - 1]).toBeGreaterThan(offsets[0]);
  });

  test('deduplicates repeated words', () => {
    const narrative = 'abandon the abandon ship and abandon hope, ability matters';
    const result = scanForBip39Words(narrative, words);

    // Should have 3 matches for "abandon" but only 1 in candidates (first occurrence)
    const abandonMatches = result.matches.filter(m => m.word === 'abandon');
    expect(abandonMatches.length).toBe(3);
  });
});
