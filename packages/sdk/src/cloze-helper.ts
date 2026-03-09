/**
 * Cloze Helper — SDK support for NCC Cloze test (cloze)
 *
 * Attackers: create narratives with [BLANK] replacing the answer word
 * Defenders: identify which candidate fills [BLANK] using LLM comprehension
 */

const BLANK_MARKER = '[BLANK]';

export interface ClozeAttack {
  /** Narrative with [BLANK] replacing the answer word */
  narrative: string;
  /** The original narrative (before blanking) */
  original: string;
  /** Byte offset of [BLANK] in the narrative */
  blankOffset: number;
  /** The word that was blanked */
  answerWord: string;
  /** Index of the answer in the candidates array */
  answerIdx: number;
}

export interface ClozeDefense {
  /** Index of the guessed candidate */
  guessIdx: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the guess */
  reasoning: string;
}

/**
 * Create a Cloze attack: replace the target word with [BLANK]
 * The narrative should be constructed so that the answer word is
 * semantically obvious from context (to reward comprehension).
 */
export function createClozeAttack(
  narrative: string,
  targetWord: string,
  candidates: string[],
): ClozeAttack {
  const targetIdx = candidates.indexOf(targetWord);
  if (targetIdx === -1) {
    throw new Error(`Target word "${targetWord}" not in candidates: ${candidates.join(', ')}`);
  }

  // Find the target word in the narrative (case-insensitive)
  const lowerNarrative = narrative.toLowerCase();
  const lowerTarget = targetWord.toLowerCase();
  const wordOffset = lowerNarrative.indexOf(lowerTarget);

  if (wordOffset === -1) {
    throw new Error(`Target word "${targetWord}" not found in narrative`);
  }

  // Replace the first occurrence with [BLANK]
  const blankedNarrative =
    narrative.slice(0, wordOffset) +
    BLANK_MARKER +
    narrative.slice(wordOffset + targetWord.length);

  // Calculate byte offset (ASCII = char offset for BIP39 words)
  const encoder = new TextEncoder();
  const blankOffset = encoder.encode(narrative.slice(0, wordOffset)).length;

  return {
    narrative: blankedNarrative,
    original: narrative,
    blankOffset,
    answerWord: targetWord,
    answerIdx: targetIdx,
  };
}

/**
 * Solve a Cloze test: given a narrative with [BLANK] and 4 candidates,
 * determine which candidate best fills the blank.
 *
 * This is the core comprehension test. LLMs should get ~75-80%.
 * Scripts guessing randomly get 25%.
 *
 * @param narrative - The narrative containing [BLANK]
 * @param candidates - 4 candidate words
 * @param llmSolver - Optional async function that uses an LLM to solve
 * @returns ClozeDefense with the guessed index
 */
export async function solveCloze(
  narrative: string,
  candidates: string[],
  llmSolver?: (prompt: string) => Promise<string>,
): Promise<ClozeDefense> {
  if (!narrative.includes(BLANK_MARKER)) {
    // No blank — fall back to random (legacy NCC behavior)
    return {
      guessIdx: Math.floor(Math.random() * candidates.length),
      confidence: 0.25,
      reasoning: 'No [BLANK] found, random guess',
    };
  }

  if (!llmSolver) {
    // No LLM available — random guess
    return {
      guessIdx: Math.floor(Math.random() * candidates.length),
      confidence: 0.25,
      reasoning: 'No LLM solver provided, random guess',
    };
  }

  const prompt = `You are solving a fill-in-the-blank word puzzle in a combat narrative.

The narrative contains [BLANK] where a word was removed. Your task: determine which of the 4 candidate words best fills the blank based on semantic context.

NARRATIVE:
"${narrative}"

CANDIDATES:
0: ${candidates[0]}
1: ${candidates[1]}
2: ${candidates[2]}
3: ${candidates[3]}

Which candidate (0-3) best fills [BLANK]? Consider:
- Grammatical fit (does it make sense in the sentence?)
- Semantic fit (does it match the context/meaning?)
- Word form (e.g., "[BLANK]ed" suggests a verb)

Reply with ONLY the number (0, 1, 2, or 3).`;

  try {
    const response = await llmSolver(prompt);
    const match = response.trim().match(/^([0-3])/);
    if (match) {
      const guessIdx = parseInt(match[1], 10);
      return {
        guessIdx,
        confidence: 0.75,
        reasoning: `LLM selected candidate ${guessIdx}: "${candidates[guessIdx]}"`,
      };
    }
  } catch {
    // LLM failed — fall through to random
  }

  return {
    guessIdx: Math.floor(Math.random() * candidates.length),
    confidence: 0.25,
    reasoning: 'LLM solver failed, random guess',
  };
}

/**
 * Verify a Cloze attack is well-formed:
 * - Narrative contains exactly one [BLANK]
 * - Answer word is a valid candidate
 * - Reconstructed narrative matches original
 */
export function verifyClozeAttack(attack: ClozeAttack, candidates: string[]): boolean {
  const blankCount = (attack.narrative.match(/\[BLANK\]/g) || []).length;
  if (blankCount !== 1) return false;

  if (!candidates.includes(attack.answerWord)) return false;

  // Reconstruct and verify
  const reconstructed = attack.narrative.replace(BLANK_MARKER, attack.answerWord);
  // Check if answer word appears at the right position in original
  if (!attack.original.toLowerCase().includes(attack.answerWord.toLowerCase())) return false;

  return true;
}
