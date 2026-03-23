/**
 * Smart Script strategy — heuristic NCC defense + adversarial poison words.
 *
 * No LLM needed. Uses text analysis heuristics to guess the intended NCC word:
 * - Position: words placed early in narrative are more likely "intended"
 * - Proximity: intended word is often near the target word
 * - Context: intended word often has more surrounding context words
 *
 * Target NCC accuracy: ~35-40% (up from 25% random baseline)
 */
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

// Common English words that constrain opponent vocabulary
const ADVERSARIAL_POISONS = [
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
  'will', 'each', 'make', 'like', 'long', 'look', 'many', 'some',
  'time', 'very', 'when', 'come', 'here', 'just', 'know', 'take',
]

// Template narratives — varied enough to avoid pattern detection
const TEMPLATES = [
  (t: string) => `Across the ${t} frontier agents forge alliances and break ciphers in pursuit of dominance.`,
  (t: string) => `Deep within the ${t} protocol lies a hidden truth about adversarial resilience.`,
  (t: string) => `The concept of ${t} drives innovation beyond what simple automation can achieve.`,
  (t: string) => `Every ${t} challenge demands creative reasoning and genuine comprehension to overcome.`,
  (t: string) => `When ${t} emerges as the focal point all strategies must adapt or face elimination.`,
  (t: string) => `Understanding ${t} requires more than pattern matching it demands true intelligence.`,
  (t: string) => `In the arena of ${t} only those who think beyond scripts will endure and prevail.`,
  (t: string) => `The path through ${t} territory reveals itself only to those who reason deeply.`,
]

function scoreCandidate(narrative: string, candidate: string, targetWord: string): number {
  const lower = narrative.toLowerCase()
  const candLower = candidate.toLowerCase()
  const targetLower = targetWord.toLowerCase()
  const idx = lower.indexOf(candLower)
  if (idx < 0) return -100

  let score = 0

  // Position bonus: earlier placement suggests intentionality
  const positionRatio = 1 - (idx / lower.length)
  score += positionRatio * 30

  // Proximity to target word: intended word is often near the target
  const targetIdx = lower.indexOf(targetLower)
  if (targetIdx >= 0) {
    const distance = Math.abs(idx - targetIdx)
    score += Math.max(0, 50 - distance) // closer = higher score
  }

  // Context density: count how many non-trivial words surround the candidate
  const contextRadius = 40
  const start = Math.max(0, idx - contextRadius)
  const end = Math.min(lower.length, idx + candLower.length + contextRadius)
  const context = lower.substring(start, end)
  const wordCount = context.split(/\s+/).filter(w => w.length > 3).length
  score += wordCount * 5

  // Length bonus: longer candidates are sometimes preferred by LLMs for naturalness
  score += candidate.length * 2

  return score
}

function heuristicNccGuess(narrative: string, candidates: string[], targetWord: string): number {
  if (!narrative || candidates.length !== 4) return 0

  const scores = candidates.map((c, i) => ({
    idx: i,
    score: scoreCandidate(narrative, c, targetWord),
  }))

  scores.sort((a, b) => b.score - a.score)
  return scores[0]!.idx
}

export const smartScriptStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber, opponentNarrative, opponentNccCandidates, narrativeHistory } = ctx

  // ── 1. NCC Defense ──
  let nccGuessIdx: 0 | 1 | 2 | 3 = 0
  if (opponentNarrative && opponentNccCandidates.length === 4) {
    nccGuessIdx = heuristicNccGuess(opponentNarrative, opponentNccCandidates, targetWord) as 0 | 1 | 2 | 3
  } else {
    // Fallback: cycle through indices (slightly better than pure random for some patterns)
    nccGuessIdx = (turnNumber % 4) as 0 | 1 | 2 | 3
  }

  // ── 2. Poison Word ──
  let chosenPoison = ADVERSARIAL_POISONS[turnNumber % ADVERSARIAL_POISONS.length]!

  // ── 3. Narrative ──
  const templateFn = TEMPLATES[turnNumber % TEMPLATES.length]!
  let narrative = templateFn(targetWord)

  // Avoid poison word
  if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
    // Try another template
    for (const t of TEMPLATES) {
      const alt = t(targetWord)
      if (!alt.toLowerCase().includes(poisonWord.toLowerCase())) {
        narrative = alt
        break
      }
    }
    // Last resort: build manually
    if (narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
      narrative = `Agents compete for ${targetWord} supremacy in realms of logic and cryptographic proof.`
    }
  }

  // Make sure our own narrative doesn't contain our chosen poison
  if (narrative.toLowerCase().includes(chosenPoison.toLowerCase())) {
    for (const alt of ADVERSARIAL_POISONS) {
      if (!narrative.toLowerCase().includes(alt.toLowerCase())) {
        chosenPoison = alt
        break
      }
    }
  }

  // Pad to 64 bytes
  const enc = new TextEncoder()
  while (enc.encode(narrative).length < 64) { narrative += ' ' }

  return {
    narrative,
    poisonWord: chosenPoison,
    nccGuessIdx,
  }
}
