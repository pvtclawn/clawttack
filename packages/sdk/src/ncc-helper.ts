/**
 * @module ncc-helper
 * @description NCC (Narrative Comprehension Challenge) helper for agent SDKs.
 *
 * Provides utilities to:
 * 1. Embed 4 BIP39 candidates in a narrative and create an NCC attack
 * 2. Defend against an opponent's NCC (pick the right candidate)
 * 3. Create and verify commitments
 *
 * Gas-efficient: uses offset-based verification (~48K gas on-chain)
 */

import { keccak256, solidityPacked, hexlify, randomBytes } from 'ethers';
import type { NccAttack, NccDefense, NccReveal } from './v4-types.ts';

/** BIP39 word with its dictionary index */
export interface BIP39Word {
  index: number;
  word: string;
}

/**
 * Find the byte offset of a full-word match in a narrative (case-insensitive).
 * Returns -1 if not found.
 *
 * Note: returns BYTE offset (UTF-8), not JS char index.
 */
export function findWordOffset(narrative: string, word: string): number {
  const narrativeLower = narrative.toLowerCase();
  const wordLower = word.toLowerCase();

  let from = 0;
  while (from < narrativeLower.length) {
    const idx = narrativeLower.indexOf(wordLower, from);
    if (idx === -1) return -1;

    const before = idx === 0 ? '' : narrativeLower[idx - 1];
    const afterIdx = idx + wordLower.length;
    const after = afterIdx >= narrativeLower.length ? '' : narrativeLower[afterIdx];

    // Require word boundaries so "able" doesn't match inside "unable"
    const beforeOk = before === '' || !/[a-z]/.test(before);
    const afterOk = after === '' || !/[a-z]/.test(after);

    if (beforeOk && afterOk) {
      return new TextEncoder().encode(narrative.slice(0, idx)).length;
    }

    from = idx + 1;
  }

  return -1;
}

/**
 * Create an NCC attack: picks 4 candidates, finds their offsets,
 * and creates a salted commitment to the intended answer.
 *
 * @param narrative - The narrative text (must already contain all 4 candidate words)
 * @param candidates - 4 BIP39 words to use as candidates
 * @param intendedIdx - Which candidate (0-3) is the intended answer
 * @returns The NCC attack + the salt (keep salt secret until reveal!)
 */
export function createNccAttack(
  narrative: string,
  candidates: [BIP39Word, BIP39Word, BIP39Word, BIP39Word],
  intendedIdx: number,
): { attack: NccAttack; salt: `0x${string}`; intendedIdx: number } {
  if (intendedIdx < 0 || intendedIdx > 3) {
    throw new Error(`intendedIdx must be 0-3, got ${intendedIdx}`);
  }

  // Verify all candidates are present and find offsets
  const offsets: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const offset = findWordOffset(narrative, candidates[i].word);
    if (offset === -1) {
      throw new Error(`Candidate "${candidates[i].word}" not found in narrative`);
    }
    offsets[i] = offset;
  }

  // Check for duplicates
  const indices = new Set(candidates.map(c => c.index));
  if (indices.size !== 4) {
    throw new Error('All 4 candidates must be distinct BIP39 words');
  }

  // Generate random salt
  const salt = hexlify(randomBytes(32)) as `0x${string}`;

  // Create commitment: keccak256(abi.encodePacked(salt, intendedIdx))
  const commitment = keccak256(
    solidityPacked(['bytes32', 'uint8'], [salt, intendedIdx]),
  ) as `0x${string}`;

  return {
    attack: {
      candidateWordIndices: [
        candidates[0].index,
        candidates[1].index,
        candidates[2].index,
        candidates[3].index,
      ],
      candidateOffsets: offsets,
      nccCommitment: commitment,
    },
    salt,
    intendedIdx,
  };
}

/**
 * Create an NCC defense: analyze the narrative and pick a candidate.
 *
 * This is where the LLM does its work — reading the narrative and
 * understanding which candidate is the correct answer.
 *
 * @param guessIdx - The LLM's guess (0-3)
 * @returns The NCC defense
 */
export function createNccDefense(guessIdx: number): NccDefense {
  if (guessIdx < 0 || guessIdx > 3) {
    throw new Error(`guessIdx must be 0-3, got ${guessIdx}`);
  }
  return { guessIdx };
}

/**
 * Create an NCC reveal from a previous attack's stored data.
 *
 * @param salt - The salt from createNccAttack
 * @param intendedIdx - The intended answer from createNccAttack
 * @returns The NCC reveal
 */
export function createNccReveal(salt: `0x${string}`, intendedIdx: number): NccReveal {
  return { salt, intendedIdx };
}

/**
 * Verify a commitment matches a salt + intendedIdx (off-chain check).
 * Useful for SDK-level validation before submitting.
 */
export function verifyCommitment(
  commitment: `0x${string}`,
  salt: `0x${string}`,
  intendedIdx: number,
): boolean {
  const computed = keccak256(
    solidityPacked(['bytes32', 'uint8'], [salt, intendedIdx]),
  );
  return computed === commitment;
}

/**
 * Embed BIP39 words into a narrative template.
 *
 * Replaces {0}, {1}, {2}, {3} placeholders with the candidate words.
 * Useful for narrative generation: write a template, then embed candidates.
 *
 * @param template - Narrative template with {0}-{3} placeholders
 * @param candidates - 4 BIP39 words
 * @returns The narrative with embedded candidates
 */
export function embedCandidates(
  template: string,
  candidates: [BIP39Word, BIP39Word, BIP39Word, BIP39Word],
): string {
  let result = template;
  for (let i = 0; i < 4; i++) {
    result = result.replace(`{${i}}`, candidates[i].word);
  }
  return result;
}
