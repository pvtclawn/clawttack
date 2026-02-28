import { describe, test, expect } from 'bun:test';
import {
  createNccAttack,
  createNccDefense,
  createNccReveal,
  verifyCommitment,
  findWordOffset,
  embedCandidates,
} from './ncc-helper.ts';
import type { BIP39Word } from './ncc-helper.ts';

const CANDIDATES: [BIP39Word, BIP39Word, BIP39Word, BIP39Word] = [
  { index: 0, word: 'abandon' },
  { index: 1, word: 'ability' },
  { index: 2, word: 'able' },
  { index: 3, word: 'about' },
];

const NARRATIVE = 'the hero must abandon all ability and be able to learn about the world';

describe('NCC Helper', () => {
  describe('findWordOffset', () => {
    test('finds word at correct offset', () => {
      expect(findWordOffset(NARRATIVE, 'abandon')).toBe(14);
      expect(findWordOffset(NARRATIVE, 'ability')).toBe(26);
      expect(findWordOffset(NARRATIVE, 'able')).toBe(41);
      expect(findWordOffset(NARRATIVE, 'about')).toBe(55);
    });

    test('case insensitive', () => {
      expect(findWordOffset('THE HERO MUST ABANDON', 'abandon')).toBe(14);
    });

    test('returns -1 for missing word', () => {
      expect(findWordOffset(NARRATIVE, 'zebra')).toBe(-1);
    });
  });

  describe('createNccAttack', () => {
    test('creates valid attack with correct offsets', () => {
      const { attack, salt, intendedIdx } = createNccAttack(NARRATIVE, CANDIDATES, 2);

      expect(attack.candidateWordIndices).toEqual([0, 1, 2, 3]);
      expect(attack.candidateOffsets).toEqual([14, 26, 41, 55]);
      expect(attack.nccCommitment).toMatch(/^0x[0-9a-f]{64}$/);
      expect(intendedIdx).toBe(2);
      expect(salt).toMatch(/^0x[0-9a-f]{64}$/);
    });

    test('commitment is verifiable', () => {
      const { attack, salt, intendedIdx } = createNccAttack(NARRATIVE, CANDIDATES, 1);
      expect(verifyCommitment(attack.nccCommitment, salt, intendedIdx)).toBe(true);
      expect(verifyCommitment(attack.nccCommitment, salt, 0)).toBe(false); // wrong idx
    });

    test('throws on invalid intendedIdx', () => {
      expect(() => createNccAttack(NARRATIVE, CANDIDATES, 5)).toThrow('intendedIdx must be 0-3');
    });

    test('throws on missing candidate', () => {
      const bad: [BIP39Word, BIP39Word, BIP39Word, BIP39Word] = [
        { index: 0, word: 'abandon' },
        { index: 1, word: 'ability' },
        { index: 2, word: 'able' },
        { index: 99, word: 'zebra' },
      ];
      expect(() => createNccAttack(NARRATIVE, bad, 0)).toThrow('not found in narrative');
    });

    test('throws on duplicate candidates', () => {
      const dupes: [BIP39Word, BIP39Word, BIP39Word, BIP39Word] = [
        { index: 0, word: 'abandon' },
        { index: 0, word: 'abandon' },
        { index: 2, word: 'able' },
        { index: 3, word: 'about' },
      ];
      expect(() => createNccAttack(NARRATIVE, dupes, 0)).toThrow('distinct');
    });

    test('each attack generates unique salt', () => {
      const a1 = createNccAttack(NARRATIVE, CANDIDATES, 0);
      const a2 = createNccAttack(NARRATIVE, CANDIDATES, 0);
      expect(a1.salt).not.toBe(a2.salt);
      expect(a1.attack.nccCommitment).not.toBe(a2.attack.nccCommitment);
    });
  });

  describe('createNccDefense', () => {
    test('creates valid defense', () => {
      expect(createNccDefense(2)).toEqual({ guessIdx: 2 });
    });

    test('throws on invalid guess', () => {
      expect(() => createNccDefense(4)).toThrow('guessIdx must be 0-3');
    });
  });

  describe('createNccReveal', () => {
    test('creates valid reveal', () => {
      const salt = '0x' + '42'.repeat(32) as `0x${string}`;
      const reveal = createNccReveal(salt, 1);
      expect(reveal.salt).toBe(salt);
      expect(reveal.intendedIdx).toBe(1);
    });
  });

  describe('embedCandidates', () => {
    test('replaces placeholders', () => {
      const template = 'The hero must {0} all {1} to be {2} and learn {3}.';
      const result = embedCandidates(template, CANDIDATES);
      expect(result).toBe('The hero must abandon all ability to be able and learn about.');
    });
  });

  describe('full flow', () => {
    test('attack → defense → reveal round-trip', () => {
      // Attacker creates NCC
      const { attack, salt, intendedIdx } = createNccAttack(NARRATIVE, CANDIDATES, 2);

      // Defender picks answer (LLM would analyze narrative here)
      const defense = createNccDefense(2); // correct guess!

      // Attacker reveals on next turn
      const reveal = createNccReveal(salt, intendedIdx);

      // Verify the commitment
      expect(verifyCommitment(attack.nccCommitment, reveal.salt, reveal.intendedIdx)).toBe(true);

      // Check if defender was correct
      expect(defense.guessIdx === reveal.intendedIdx).toBe(true);
    });

    test('wrong defense does not match', () => {
      const { attack, salt, intendedIdx } = createNccAttack(NARRATIVE, CANDIDATES, 3);
      const defense = createNccDefense(0); // wrong guess
      const reveal = createNccReveal(salt, intendedIdx);

      expect(verifyCommitment(attack.nccCommitment, reveal.salt, reveal.intendedIdx)).toBe(true);
      expect(defense.guessIdx === reveal.intendedIdx).toBe(false);
    });
  });
});
