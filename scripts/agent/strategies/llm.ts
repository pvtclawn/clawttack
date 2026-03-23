/**
 * LLM-powered strategy — uses OpenAI-compatible API (OpenRouter, Groq, Ollama, openclaw gateway).
 *
 * Environment:
 *   LLM_URL — API endpoint (default: https://openrouter.ai/api/v1)
 *   LLM_API_KEY — API key
 *   LLM_MODEL — model identifier (default: google/gemini-2.5-flash-preview)
 */
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

const LLM_URL = process.env.LLM_URL || 'https://openrouter.ai/api/v1'
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview'

async function callLLM(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(`${LLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: 400,
      temperature: 0.8,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`LLM API error ${res.status}: ${errText}`)
  }

  const data = await res.json() as any
  return data.choices?.[0]?.message?.content?.trim() || ''
}

// System prompt derived from SKILL.md
const SYSTEM_PROMPT = `You are an AI agent competing in Clawttack — an on-chain battle arena.

RULES:
- Each turn you write a narrative (64-256 bytes, ASCII only)
- Your narrative MUST contain the target word (case-insensitive)
- Your narrative MUST NOT contain the opponent's poison word
- You pick a poison word (4-32 chars, ASCII) for the opponent's next turn
- NCC defense: opponent embedded 4 BIP39 words in their narrative, you guess which is "intended" (0-3)

STRATEGY:
- Write creative, coherent prose — NOT templates
- Embed the target word naturally
- Choose poison words that constrain the opponent's vocabulary (common English words are best)
- For NCC defense: the intended word usually fits the narrative most naturally
- Try social engineering: craft narratives that might trick opponents into mistakes
- Use jokers (up to 1024 bytes) for complex attacks or misdirection

OUTPUT FORMAT — respond with EXACTLY this JSON, nothing else:
{
  "narrative": "your narrative text here",
  "poisonWord": "chosen poison word",
  "nccGuessIdx": 0
}`

export const llmStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber, opponentNarrative, myBank, opponentBank, jokersRemaining } = ctx

  const userPrompt = [
    `Turn ${turnNumber}. Target word: "${targetWord}".`,
    poisonWord ? `Opponent's poison word (AVOID): "${poisonWord}".` : '',
    opponentNarrative ? `Opponent's last narrative: "${opponentNarrative}"` : '',
    `Your bank: ${myBank} / Opponent bank: ${opponentBank}.`,
    jokersRemaining > 0 ? `You have ${jokersRemaining} jokers available (allows up to 1024 byte narratives).` : '',
    opponentNarrative && ctx.opponentNccCandidates.length === 4
      ? `NCC Defense — opponent's 4 candidate words: [${ctx.opponentNccCandidates.join(', ')}]. Pick which index (0-3) is their intended answer.`
      : 'NCC Defense: pick 0 (no opponent data yet).',
    `Write a creative narrative containing "${targetWord}" and respond with the JSON.`,
  ].filter(Boolean).join('\n')

  try {
    const raw = await callLLM([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ])

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = raw
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1]!
    else {
      const braceMatch = raw.match(/\{[\s\S]*\}/)
      if (braceMatch) jsonStr = braceMatch[0]!
    }

    const parsed = JSON.parse(jsonStr)

    let narrative: string = parsed.narrative || ''
    const chosenPoison: string = parsed.poisonWord || 'nebula'
    const nccGuess: number = typeof parsed.nccGuessIdx === 'number' ? parsed.nccGuessIdx : 0

    // Validate & fix narrative
    if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
      // Append target word if LLM forgot
      narrative += ` The ${targetWord} echoes.`
    }
    if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
      // LLM included poison word — regenerate with simple fallback
      console.warn(`[LLM] Narrative contained poison word "${poisonWord}", using fallback`)
      narrative = `In the ${targetWord} domain we find clarity and purpose through adversarial competition and cryptographic proof.`
    }

    // Pad to 64 bytes
    if (new TextEncoder().encode(narrative).length < 64) {
      narrative += ' '.repeat(64 - new TextEncoder().encode(narrative).length)
    }
    // Truncate to 256 bytes
    const enc = new TextEncoder()
    if (enc.encode(narrative).length > 256) {
      const dec = new TextDecoder()
      narrative = dec.decode(enc.encode(narrative).slice(0, 256))
    }

    // Validate poison word
    let finalPoison = chosenPoison
    if (finalPoison.length < 4 || finalPoison.length > 32) finalPoison = 'quantum'
    if (!/^[\x00-\x7f]+$/.test(finalPoison)) finalPoison = 'quantum'

    return {
      narrative,
      poisonWord: finalPoison,
      nccGuessIdx: Math.max(0, Math.min(3, Math.floor(nccGuess))) as 0 | 1 | 2 | 3,
    }
  } catch (err) {
    console.error('[LLM] Strategy error, using fallback:', err)
    // Fallback to template if LLM fails
    return {
      narrative: `In the ${targetWord} domain we find clarity and purpose through adversarial competition.` + ' '.repeat(10),
      poisonWord: 'quantum',
      nccGuessIdx: 0,
    }
  }
}
