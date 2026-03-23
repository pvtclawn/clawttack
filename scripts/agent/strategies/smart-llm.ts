/**
 * Smart LLM strategy — model-agnostic, single-call NCC defense + narrative + poison.
 *
 * Works with ANY OpenRouter model — reasoning or non-reasoning, fast or slow.
 * Handles: reasoning field extraction, 429 retry, timeout safety, JSON recovery.
 *
 * Environment:
 *   LLM_URL       — API endpoint (default: https://openrouter.ai/api/v1)
 *   LLM_API_KEY   — API key (falls back to OPENROUTER_API_KEY)
 *   LLM_MODEL     — model identifier (default: google/gemini-2.5-flash-preview)
 *   LLM_TIMEOUT   — request timeout in ms (default: 15000)
 *   LLM_MAX_TOKENS — max tokens (default: 512, increase for reasoning models)
 */
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

// ─── Configuration (all env-overridable) ─────────────────────────────────────

const LLM_URL        = process.env.LLM_URL || 'https://openrouter.ai/api/v1'
const LLM_API_KEY    = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || ''
const LLM_MODEL      = process.env.LLM_MODEL || 'google/gemini-2.5-flash-preview'
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT) || 15_000
const LLM_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 512
const LLM_MAX_RETRIES = 2
const LLM_RETRY_DELAY = 2_000

// ─── LLM API call (model-agnostic) ───────────────────────────────────────────

async function callLLM(messages: { role: string; content: string }[]): Promise<string> {
  const t0 = Date.now()
  console.log(`[smart-llm] ${LLM_MODEL} (timeout=${LLM_TIMEOUT_MS}ms, max_tokens=${LLM_MAX_TOKENS})`)

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${LLM_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages,
          max_tokens: LLM_MAX_TOKENS,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      })

      if (res.status === 429 && attempt < LLM_MAX_RETRIES) {
        console.log(`[smart-llm] 429 rate-limited, retry ${attempt + 1}/${LLM_MAX_RETRIES}...`)
        await new Promise(r => setTimeout(r, LLM_RETRY_DELAY))
        continue
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '(unreadable)')
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`)
      }

      const data = await res.json() as any
      const msg = data.choices?.[0]?.message
      const elapsed = Date.now() - t0

      // Model-agnostic content extraction:
      // 1. Standard: content field
      // 2. Reasoning models: reasoning field (when content is null/empty)
      let content = msg?.content?.trim() || ''
      if (!content && msg?.reasoning) {
        content = typeof msg.reasoning === 'string'
          ? msg.reasoning
          : msg.reasoning_details?.[0]?.text || ''
        console.log(`[smart-llm] Extracted from reasoning field (${content.length} chars)`)
      }

      console.log(`[smart-llm] ✅ ${elapsed}ms | ${data.usage?.total_tokens || '?'} tok | ${content.length} chars`)
      return content
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        console.log(`[smart-llm] ⏱ Timeout after ${LLM_TIMEOUT_MS}ms (attempt ${attempt + 1})`)
        if (attempt < LLM_MAX_RETRIES) continue
      }
      throw err
    }
  }

  throw new Error('LLM: max retries exceeded')
}

// ─── JSON extraction (handles markdown fences, reasoning chains, partial) ────────────

function extractJSON(raw: string): Record<string, any> | null {
  // Try 1: ```json ... ``` blocks
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced) {
    try { return JSON.parse(fenced[1]!) } catch {}
  }

  // Try 2: find ALL brace-balanced JSON objects and try to parse each
  const candidates: string[] = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      let depth = 0
      let inStr = false
      let escaped = false
      for (let j = i; j < raw.length; j++) {
        const c = raw[j]!
        if (escaped) { escaped = false; continue }
        if (c === '\\' && inStr) { escaped = true; continue }
        if (c === '"') { inStr = !inStr; continue }
        if (inStr) continue
        if (c === '{') depth++
        if (c === '}') {
          depth--
          if (depth === 0) {
            candidates.push(raw.slice(i, j + 1))
            break
          }
        }
      }
    }
  }

  // Try each candidate, prefer ones with "narrative"
  let bestMatch: Record<string, any> | null = null
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      if (typeof parsed === 'object' && parsed !== null) {
        if ('narrative' in parsed) return parsed  // best possible match
        if (!bestMatch) bestMatch = parsed
      }
    } catch {}
  }
  if (bestMatch) return bestMatch

  // Try 3: extract fields individually (for reasoning chains that discuss the JSON)
  const narrative = raw.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    || raw.match(/narrative[:\s]+"((?:[^"\\]|\\.)*)"/i)?.[1]
  if (narrative) {
    const ncc = raw.match(/"?nccGuessIdx"?\s*:\s*(\d)/)?.[1]
    const vop = raw.match(/"?vopGuessIdx"?\s*:\s*(\d+)/)?.[1]
    const poison = raw.match(/"?poisonWord"?\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    return {
      narrative: narrative.replace(/\\"/g, '"'),
      nccGuessIdx: ncc ? Number(ncc) : 0,
      vopGuessIdx: vop ? Number(vop) : 0,
      poisonWord: poison?.replace(/\\"/g, '"') || '',
    }
  }

  console.log(`[smart-llm] JSON extraction failed. Raw (${raw.length} chars): ${raw.slice(0, 200)}`)
  return null
}

// ─── Adversarial poison words ────────────────────────────────────────────────

const ADVERSARIAL_POISONS = [
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
  'will', 'each', 'make', 'like', 'long', 'look', 'many', 'some',
  'time', 'very', 'when', 'come', 'here', 'just', 'know', 'take',
  'into', 'over', 'also', 'back', 'much', 'then', 'them', 'well',
]

// ─── Compact prompt (minimizes token usage for any model) ────────────────────

const SYSTEM_PROMPT = `You play Clawttack. Each turn: write a narrative (170-180 bytes, ASCII) with the TARGET word, avoid POISON word, guess opponent's NCC candidate (0-3).

Reply ONLY with JSON:
{"narrative":"...","poisonWord":"4-32char word","nccGuessIdx":0,"vopGuessIdx":0}`

// ─── Strategy ────────────────────────────────────────────────────────────────

export const smartLlmStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber, opponentNarrative, opponentNccCandidates, myBank, opponentBank } = ctx

  let defaultPoison = ADVERSARIAL_POISONS[turnNumber % ADVERSARIAL_POISONS.length]!

  // Build compact prompt
  const lines = [
    `Turn ${turnNumber}. TARGET: "${targetWord}".`,
    poisonWord ? `POISON (avoid!): "${poisonWord}".` : '',
    `Banks: you=${myBank} opp=${opponentBank}.`,
  ]

  if (opponentNarrative && opponentNccCandidates.length === 4) {
    lines.push(
      `Opponent said: "${opponentNarrative}"`,
      `NCC candidates: [0:"${opponentNccCandidates[0]}", 1:"${opponentNccCandidates[1]}", 2:"${opponentNccCandidates[2]}", 3:"${opponentNccCandidates[3]}"]`,
      `Guess which candidate (0-3) is the hidden target. Set nccGuessIdx.`,
    )
  }

  lines.push(`Write creative narrative with "${targetWord}". JSON only.`)

  try {
    const raw = await callLLM([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: lines.filter(Boolean).join('\n') },
    ])

    const parsed = extractJSON(raw)
    if (!parsed) throw new Error('No JSON found in response')

    let narrative: string = parsed.narrative || ''
    const nccGuess: number = typeof parsed.nccGuessIdx === 'number' ? parsed.nccGuessIdx : 0
    const llmPoison: string = parsed.poisonWord || ''

    // Use LLM's poison if valid, otherwise use our pre-selected one
    if (llmPoison.length >= 4 && llmPoison.length <= 32 && /^[\x00-\x7f]+$/.test(llmPoison)) {
      defaultPoison = llmPoison
    }

    // Strip wrapping quotes
    narrative = narrative.replace(/^["']|["']$/g, '').trim()

    // Validate & fix narrative
    if (!narrative || narrative.length < 10) {
      narrative = `In the ${targetWord} domain we find clarity through adversarial competition and cryptographic proof.`
    }
    if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
      narrative += ` The ${targetWord} echoes.`
    }
    if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
      narrative = `Across realms of ${targetWord} logic and pattern, agents compete for dominance and survival.`
    }

    // Ensure our narrative doesn't contain our chosen poison
    if (narrative.toLowerCase().includes(defaultPoison.toLowerCase())) {
      for (const alt of ADVERSARIAL_POISONS) {
        if (!narrative.toLowerCase().includes(alt.toLowerCase()) && alt.length >= 4) {
          defaultPoison = alt
          break
        }
      }
    }

    return {
      narrative,
      poisonWord: defaultPoison,
      nccGuessIdx: Math.max(0, Math.min(3, Math.floor(nccGuess))) as 0 | 1 | 2 | 3,
      vopGuessIdx: typeof parsed.vopGuessIdx === 'number' ? parsed.vopGuessIdx : 0,
      vopExtraction: parsed.vopExtraction,
    }
  } catch (err) {
    console.error('[smart-llm] Fallback:', (err as Error).message || err)
    return {
      narrative: `In the ${targetWord} domain agents compete for dominance through adversarial reasoning and proof.` + ' '.repeat(5),
      poisonWord: defaultPoison,
      nccGuessIdx: 0,
      vopGuessIdx: 0,
    }
  }
}
