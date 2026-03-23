/**
 * OpenClaw Agent strategy — same architecture as hermes.ts but reads skill from
 * ~/.openclaw/workspace/skills/clawttack/SKILL.md (OpenClaw skill directory).
 *
 * Calls OpenRouter directly with the SKILL.md injected into the user message.
 *
 * Environment:
 *   OPENROUTER_API_KEY — required
 *   OPENCLAW_MODEL     — model (default: nousresearch/hermes-3-llama-3.1-8b)
 *   OPENCLAW_TIMEOUT   — ms (default: 30000)
 *   OPENCLAW_HOME      — path to openclaw home (default: ~/.openclaw)
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || ''
const OPENCLAW_MODEL     = process.env.OPENCLAW_MODEL || process.env.HERMES_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
const OPENCLAW_TIMEOUT   = Number(process.env.OPENCLAW_TIMEOUT) || 30_000
const OPENCLAW_HOME      = process.env.OPENCLAW_HOME || join(homedir(), '.openclaw')
const OPENROUTER_BASE    = 'https://openrouter.ai/api/v1'

// ─── Load SKILL.md ────────────────────────────────────────────────────────────

function loadSkill(): string {
  const skillPath = join(OPENCLAW_HOME, 'workspace', 'skills', 'clawttack', 'SKILL.md')

  if (existsSync(skillPath)) {
    const skill = readFileSync(skillPath, 'utf-8')
    const stripped = skill.replace(/^---[\s\S]*?---\n?/, '').trim()
    console.log(`[openclaw] ✅ Loaded SKILL.md from ${skillPath}`)
    return `You are an AI agent playing Clawttack. The following is your loaded skill:\n\n${stripped}\n\nCRITICAL: Your narrative MUST contain the TARGET word VERBATIM (exact spelling). Reply ONLY with JSON (no markdown): {"narrative":"...","poisonWord":"...","nccGuessIdx":0,"vopGuessIdx":1,"myVopIdx":0}`
  }

  console.log(`[openclaw] ⚠️  SKILL.md not found at ${skillPath}, using inline skill`)
  return `You are OpenClaw playing Clawttack. Each turn: write a narrative containing the TARGET word VERBATIM (required). Do NOT use the POISON word. Choose a poison word for opponent.
Reply ONLY with JSON: {"narrative":"...","poisonWord":"4-32char word","nccGuessIdx":0,"vopGuessIdx":1,"myVopIdx":0}`
}

const SKILL_PROMPT = loadSkill()

// ─── Fallback poison list (different selection than hermes for variety) ────────

const ADVERSARIAL_POISONS = [
  'with', 'from', 'this', 'that', 'have', 'been', 'were', 'they',
  'will', 'each', 'make', 'like', 'some', 'many', 'long', 'look',
  'very', 'when', 'come', 'here', 'take', 'just', 'know', 'into',
  'over', 'also', 'back', 'much', 'then', 'them', 'well', 'time',
]

// ─── OpenRouter API call ──────────────────────────────────────────────────────

async function callOpenRouter(userMessage: string): Promise<string> {
  const t0 = Date.now()
  console.log(`[openclaw] openrouter ${OPENCLAW_MODEL}`)

  const fullMessage = `${SKILL_PROMPT}\n\n---\n\n${userMessage}`

  const req = fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'X-Title': 'Clawttack OpenClaw Agent',
    },
    body: JSON.stringify({
      model: OPENCLAW_MODEL,
      messages: [{ role: 'user', content: fullMessage }],
      max_tokens: 512,
      temperature: 0.8,
    }),
  })

  // Safe timeout for Bun to prevent AbortSignal silent crashes
  const timeout = new Promise<Response>((_, reject) => 
    setTimeout(() => reject(new Error('OpenRouter API timeout')), OPENCLAW_TIMEOUT)
  )

  const res = await Promise.race([req, timeout])

  if (!res.ok) {
    const errText = await res.text().catch(() => '(unreadable)')
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as any
  const msg = data.choices?.[0]?.message
  const elapsed = Date.now() - t0

  let content = msg?.content?.trim() || ''
  if (!content && msg?.reasoning) {
    content = typeof msg.reasoning === 'string'
      ? msg.reasoning
      : msg.reasoning_details?.[0]?.text || ''
  }

  console.log(`[openclaw] ✅ ${elapsed}ms | ${data.usage?.total_tokens || '?'} tok | ${content.length} chars`)
  return content
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJSON(raw: string): Record<string, any> | null {
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced) { try { return JSON.parse(fenced[1]!) } catch {} }

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      let depth = 0, inStr = false, escaped = false
      let j = i
      for (; j < raw.length; j++) {
        const c = raw[j]!
        if (escaped) { escaped = false; continue }
        if (c === '\\' && inStr) { escaped = true; continue }
        if (c === '"') { inStr = !inStr; continue }
        if (inStr) continue
        if (c === '{') depth++
        if (c === '}') { depth--; if (depth === 0) break }
      }
      try {
        const parsed = JSON.parse(raw.slice(i, j + 1))
        if (typeof parsed === 'object' && parsed !== null && 'narrative' in parsed) return parsed
      } catch {}
    }
  }

  const narrative = raw.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
  if (narrative) {
    const ncc = raw.match(/"?nccGuessIdx"?\s*:\s*(\d)/)?.[1]
    const poison = raw.match(/"?poisonWord"?\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    return { narrative: narrative.replace(/\\"/g, '"'), nccGuessIdx: ncc ? Number(ncc) : 0, poisonWord: poison?.replace(/\\"/g, '"') || '' }
  }

  console.log(`[openclaw] JSON extraction failed. Raw: ${raw.slice(0, 200)}`)
  return null
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

export const openclawStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber, opponentNarrative, opponentNccCandidates, myBank, opponentBank, jokersRemaining } = ctx

  // Rotate through poisons differently than hermes (shifted offset)
  let defaultPoison = ADVERSARIAL_POISONS[(turnNumber + 8) % ADVERSARIAL_POISONS.length]!

  const lines = [
    `Turn ${turnNumber}. TARGET: "${targetWord}".`,
    poisonWord ? `POISON to avoid: "${poisonWord}".` : '',
    `Banks: mine=${myBank} opp=${opponentBank}.`,
  ]

  if (jokersRemaining && jokersRemaining > 0) {
    lines.push(`You have ${jokersRemaining} JOKERS. Use one by writing a LONG narrative (>256 chars, up to 1024 chars) to overwhelm the opponent context!`)
  }

  if (opponentNarrative && opponentNccCandidates.length === 4) {
    lines.push(
      `Opponent: "${opponentNarrative}"`,
      `NCC candidates: [0:"${opponentNccCandidates[0]}", 1:"${opponentNccCandidates[1]}", 2:"${opponentNccCandidates[2]}", 3:"${opponentNccCandidates[3]}"]`,
      `Pick nccGuessIdx (0-3).`,
      `VOP types available: [${ctx.vopTypes.map((v, i) => `${i}:${v}`).join(', ')}]`,
      `Pick a vopGuessIdx (0-${ctx.vopTypes.length - 1}) that opponent likely chose.`,
      `Also pick YOUR myVopIdx (0-${ctx.vopTypes.length - 1}).`,
    )
  }
  lines.push(`CRITICAL: Write a narrative containing "${targetWord}" VERBATIM. ${poisonWord ? `Do NOT use "${poisonWord}".` : ''} Reply with JSON only.`)

  try {
    const raw = await callOpenRouter(lines.filter(Boolean).join('\n'))
    const parsed = extractJSON(raw)
    if (!parsed) throw new Error('No JSON found')

    let narrative: string = parsed.narrative || ''
    const nccGuess = typeof parsed.nccGuessIdx === 'number' ? parsed.nccGuessIdx : 0
    const llmPoison = parsed.poisonWord || ''

    if (llmPoison.length >= 4 && llmPoison.length <= 32 && /^[\x00-\x7f]+$/.test(llmPoison)) {
      defaultPoison = llmPoison
    }

    narrative = narrative.replace(/^["']|["']$/g, '').trim()
    narrative = narrative.replace(/[^\x00-\x7F]/g, ' ')

    if (!narrative || narrative.length < 10) {
      narrative = `In the ${targetWord} domain agents compete through adversarial reasoning and cryptographic proof.`
    }
    narrative = narrative.replace(new RegExp(`^(?:The )?${targetWord}\\s+The `, 'i'), 'The ')
    narrative = narrative.replace(new RegExp(`^${targetWord}\\s+`, 'i'), '')
    if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
      narrative += ` The ${targetWord} stands.`
    }
    if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
      narrative = `Across realms of ${targetWord} logic, agents compete for dominance and cryptographic victory.`
    }
    if (narrative.toLowerCase().includes(defaultPoison.toLowerCase())) {
      for (const alt of ADVERSARIAL_POISONS) {
        if (!narrative.toLowerCase().includes(alt.toLowerCase()) && alt.length >= 4) {
          defaultPoison = alt; break
        }
      }
    }

    return {
      narrative,
      poisonWord: defaultPoison,
      nccGuessIdx: Math.max(0, Math.min(3, Math.floor(nccGuess))) as 0 | 1 | 2 | 3,
      vopGuessIdx: typeof parsed.vopGuessIdx === 'number' ? parsed.vopGuessIdx : 1,
      myVopIdx: typeof parsed.myVopIdx === 'number' ? parsed.myVopIdx : undefined,
      vopExtraction: parsed.vopExtraction,
    }
  } catch (err) {
    console.error('[openclaw] Fallback:', (err as Error).message || err)
    return {
      narrative: `In the ${targetWord} domain agents compete through adversarial reasoning and cryptographic proof.` + ' '.repeat(5),
      poisonWord: defaultPoison,
      nccGuessIdx: 0,
      vopGuessIdx: 1,
    }
  }
}
