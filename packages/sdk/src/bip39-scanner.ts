/**
 * @module bip39-scanner
 * @description Scans narrative text for BIP39 dictionary words.
 *
 * Used by Fighter to:
 * 1. Find all BIP39 words present in a narrative
 * 2. Pick 4 candidates for NCC attack
 * 3. Calculate byte offsets for on-chain verification
 *
 * Works with any WordDictionary contract or a local word list.
 */

import { ethers } from 'ethers';

// ─── Types ──────────────────────────────────────────────────────────────

export interface WordMatch {
  /** BIP39 word index (0-2047) */
  wordIndex: number;
  /** The matched word string */
  word: string;
  /** Byte offset in the narrative where the word starts */
  byteOffset: number;
}

export interface ScanResult {
  /** All BIP39 words found in the narrative */
  matches: WordMatch[];
  /** 4 recommended candidates for NCC attack (diverse positions) */
  candidates: WordMatch[] | null;
}

// ─── Scanner ────────────────────────────────────────────────────────────

/**
 * Scans a narrative for BIP39 dictionary words.
 *
 * @param narrative - The narrative text to scan
 * @param wordList - Array of all BIP39 words (2048 entries), indexed by word index
 * @param excludeWords - Words to exclude from results (e.g., target word, poison word)
 * @returns ScanResult with all matches and recommended candidates
 */
export function scanForBip39Words(
  narrative: string,
  wordList: string[],
  excludeWords: string[] = [],
): ScanResult {
  const narrativeLower = narrative.toLowerCase();
  const narrativeBytes = new TextEncoder().encode(narrative);
  const excludeSet = new Set(excludeWords.map(w => w.toLowerCase()));

  // Build a set of all BIP39 words for fast lookup
  const wordToIndex = new Map<string, number>();
  for (let i = 0; i < wordList.length; i++) {
    const w = wordList[i].toLowerCase();
    if (!excludeSet.has(w)) {
      wordToIndex.set(w, i);
    }
  }

  const matches: WordMatch[] = [];

  // Scan narrative word by word
  // We need byte offsets, so work with the encoded bytes
  let charIdx = 0;
  const words = narrativeLower.split(/\b/); // split on word boundaries

  let bytePos = 0;
  for (const segment of words) {
    const segmentBytes = new TextEncoder().encode(
      narrative.substring(charIdx, charIdx + segment.length),
    );
    const segmentLower = segment.toLowerCase();

    if (wordToIndex.has(segmentLower)) {
      matches.push({
        wordIndex: wordToIndex.get(segmentLower)!,
        word: segmentLower,
        byteOffset: bytePos,
      });
    }

    bytePos += segmentBytes.length;
    charIdx += segment.length;
  }

  // Pick 4 candidates with diverse positions
  const candidates = pickCandidates(matches, 4);

  return { matches, candidates };
}

/**
 * Picks N candidates from matches, spread across the narrative.
 * Prefers words at different positions for better NCC quality.
 */
function pickCandidates(matches: WordMatch[], count: number): WordMatch[] | null {
  if (matches.length < count) return null;

  // Deduplicate by word (keep first occurrence)
  const seen = new Set<string>();
  const unique: WordMatch[] = [];
  for (const m of matches) {
    if (!seen.has(m.word)) {
      seen.add(m.word);
      unique.push(m);
    }
  }

  if (unique.length < count) return null;

  // Strategy: pick words spread across the narrative
  // Sort by byte offset, then pick evenly spaced
  const sorted = [...unique].sort((a, b) => a.byteOffset - b.byteOffset);
  const step = sorted.length / count;
  const result: WordMatch[] = [];

  for (let i = 0; i < count; i++) {
    const idx = Math.min(Math.floor(i * step), sorted.length - 1);
    result.push(sorted[idx]);
  }

  // Ensure exactly `count` unique candidates
  if (new Set(result.map(r => r.word)).size < count) {
    // Fallback: just take the first `count` unique
    return unique.slice(0, count);
  }

  return result;
}

// ─── Word List Loading ──────────────────────────────────────────────────

const WORD_DICT_ABI = [
  'function word(uint16 index) view returns (string)',
  'function wordCount() view returns (uint16)',
];

/**
 * Loads the full BIP39 word list from a WordDictionary contract.
 * Caches the result for subsequent calls.
 *
 * @param contractAddress - WordDictionary contract address
 * @param provider - Ethers provider
 * @returns Array of 2048 BIP39 words
 */
export async function loadWordList(
  contractAddress: string,
  provider: ethers.Provider,
): Promise<string[]> {
  const dict = new ethers.Contract(contractAddress, WORD_DICT_ABI, provider);
  const count = await dict.wordCount();
  const wordCount = Number(count);

  // Batch load in parallel (chunks of 20 to avoid RPC rate limits)
  const words: string[] = new Array(wordCount);
  const chunkSize = 20;

  for (let start = 0; start < wordCount; start += chunkSize) {
    const end = Math.min(start + chunkSize, wordCount);
    const promises = [];
    for (let i = start; i < end; i++) {
      promises.push(dict.word(i).then((w: string) => { words[i] = w; }));
    }
    await Promise.all(promises);
  }

  return words;
}

/**
 * Minimal BIP39 word list for testing (first 20 words).
 * Use loadWordList() for production.
 */
export const BIP39_TEST_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above',
  'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve',
  'acid', 'acoustic', 'acquire', 'across', 'act',
];
