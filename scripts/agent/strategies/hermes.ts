/**
 * Hermes Agent strategy — routes turn decisions through the local Hermes
 * Gateway API server running inside the Docker container.
 *
 * The Hermes Gateway exposes an OpenAI-compatible endpoint at
 * http://localhost:8642/v1/chat/completions. Each request is processed
 * through the full Hermes Agent cognitive pipeline:
 *   • SKILL.md loaded from ~/.hermes/skills/web3/clawttack/
 *   • Reasoning chains and context management
 *   • Terminal tool access (PI/SE attack surface)
 *   • LLM provider routing (Codex OAuth, OpenRouter, Anthropic, etc.)
 *
 * When the Gateway is not available (e.g., running outside Docker),
 * falls back to direct OpenRouter calls.
 *
 * Environment:
 *   HERMES_API_URL     — Gateway API base (default: http://127.0.0.1:8642/v1)
 *   OPENROUTER_API_KEY — fallback for direct LLM calls
 *   HERMES_MODEL       — model for fallback (default: meta-llama/llama-3.3-70b-instruct:free)
 *   HERMES_TIMEOUT     — request timeout in ms (default: 60000)
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

// ─── Configuration ────────────────────────────────────────────────────────────

const HERMES_API_URL     = process.env.HERMES_API_URL || 'http://127.0.0.1:8642/v1'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || ''
const HERMES_MODEL       = process.env.HERMES_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
const HERMES_TIMEOUT     = Number(process.env.HERMES_TIMEOUT) || 120_000
const HERMES_HOME        = process.env.HERMES_HOME || join(homedir(), '.hermes')
const OPENROUTER_BASE    = 'https://openrouter.ai/api/v1'

// ─── Battle conversation history (persists across turns within a battle) ───────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

let battleHistory: ChatMessage[] = []
let lastBattleId: string | null = null

// ─── Gateway availability check ───────────────────────────────────────────────

let _gatewayAvailable: boolean | null = null

async function isGatewayAvailable(): Promise<boolean> {
  if (_gatewayAvailable !== null) return _gatewayAvailable

  try {
    const res = await fetch(`${HERMES_API_URL.replace('/v1', '')}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    _gatewayAvailable = res.ok
    if (_gatewayAvailable) {
      console.log(`[hermes] ✅ Gateway API available at ${HERMES_API_URL}`)
    }
  } catch {
    _gatewayAvailable = false
    console.log(`[hermes] ⚠️  Gateway not available, will use direct LLM fallback`)
  }
  return _gatewayAvailable
}

// ─── Load SKILL.md (for fallback mode only) ───────────────────────────────────

function loadSkillSystemPrompt(): string {
  const skillPaths = [
    join(HERMES_HOME, 'skills', 'web3', 'clawttack', 'SKILL.md'),
    join(process.cwd(), 'scripts', 'agent', 'docker', 'SKILL.md'),
  ]

  for (const p of skillPaths) {
    if (existsSync(p)) {
      const skill = readFileSync(p, 'utf-8')
      const stripped = skill.replace(/^---[\s\S]*?---\n?/, '').trim()
      console.log(`[hermes] ✅ Loaded SKILL.md from ${p}`)
      return `You are an AI agent playing Clawttack. The following is your loaded skill:\n\n${stripped}\n\nCRITICAL: Your narrative MUST contain the TARGET word VERBATIM. Reply ONLY with JSON: {"narrative":"...","poisonWord":"...","nccGuessIdx":0,"vopGuessIdx":1,"myVopIdx":0}`
    }
  }

  console.log(`[hermes] ⚠️  SKILL.md not found, using inline skill`)
  return `You play Clawttack. Write a narrative containing the TARGET word VERBATIM. Do NOT use the POISON word. Choose a poison word for opponent.
Reply ONLY with JSON: {"narrative":"...","poisonWord":"4-32char word","nccGuessIdx":0,"vopGuessIdx":1,"myVopIdx":0}`
}

const SYSTEM_PROMPT = loadSkillSystemPrompt()

// ─── Adversarial poison fallback list ────────────────────────────────────────

const ADVERSARIAL_POISONS = [
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
  'will', 'each', 'make', 'like', 'long', 'look', 'many', 'some',
  'time', 'very', 'when', 'come', 'here', 'just', 'know', 'take',
  'into', 'over', 'also', 'back', 'much', 'then', 'them', 'well',
]

// ─── Call the Hermes Gateway (real agent) ─────────────────────────────────────

async function callHermesGateway(messages: ChatMessage[]): Promise<string> {
  const t0 = Date.now()
  console.log(`[hermes] 🧠 gateway ${HERMES_API_URL}`)

  const res = await fetch(`${HERMES_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(HERMES_TIMEOUT),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '(unreadable)')
    throw new Error(`Gateway HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json() as any
  const content = data.choices?.[0]?.message?.content?.trim() || ''
  const elapsed = Date.now() - t0

  console.log(`[hermes] ✅ gateway ${elapsed}ms | ${content.length} chars`)
  return content
}

// ─── Direct LLM fallback (when running without Docker) ────────────────────────

async function callOpenRouterFallback(userMessage: string): Promise<string> {
  const t0 = Date.now()
  console.log(`[hermes] 📡 openrouter fallback ${HERMES_MODEL}`)

  const fullMessage = `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}`

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'X-Title': 'Clawttack Hermes Agent',
    },
    body: JSON.stringify({
      model: HERMES_MODEL,
      messages: [{ role: 'user', content: fullMessage }],
      max_tokens: 512,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(HERMES_TIMEOUT),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '(unreadable)')
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as any
  const msg = data.choices?.[0]?.message
  let content = msg?.content?.trim() || ''
  if (!content && msg?.reasoning) {
    content = typeof msg.reasoning === 'string' ? msg.reasoning : msg.reasoning_details?.[0]?.text || ''
  }

  console.log(`[hermes] ✅ fallback ${Date.now() - t0}ms | ${data.usage?.total_tokens || '?'} tok`)
  return content
}

// ─── Unified LLM call ─────────────────────────────────────────────────────────

async function callAgent(userMessage: string, messages: ChatMessage[]): Promise<string> {
  if (await isGatewayAvailable()) {
    return callHermesGateway(messages)
  }
  return callOpenRouterFallback(userMessage)
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJSON(raw: string): Record<string, any> | null {
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced) { try { return JSON.parse(fenced[1]!) } catch {} }

  const candidates: string[] = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      let depth = 0, inStr = false, escaped = false
      for (let j = i; j < raw.length; j++) {
        const c = raw[j]!
        if (escaped) { escaped = false; continue }
        if (c === '\\' && inStr) { escaped = true; continue }
        if (c === '"') { inStr = !inStr; continue }
        if (inStr) continue
        if (c === '{') depth++
        if (c === '}') {
          depth--
          if (depth === 0) { candidates.push(raw.slice(i, j + 1)); break }
        }
      }
    }
  }

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      if (typeof parsed === 'object' && parsed !== null && 'narrative' in parsed) return parsed
    } catch {}
  }

  const narrative = raw.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
  if (narrative) {
    const ncc = raw.match(/"?nccGuessIdx"?\s*:\s*(\d)/)?.[1]
    const poison = raw.match(/"?poisonWord"?\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    return {
      narrative: narrative.replace(/\\"/g, '"'),
      nccGuessIdx: ncc ? Number(ncc) : 0,
      poisonWord: poison?.replace(/\\"/g, '"') || '',
    }
  }

  console.log(`[hermes] JSON extraction failed. Raw: ${raw.slice(0, 200)}`)
  return null
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

export const hermesStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber, opponentNarrative, opponentNccCandidates, myNccCandidateWords, myBank, opponentBank, jokersRemaining, battleAddress } = ctx

  // Reset history for new battles
  const battleKey = battleAddress
  if (lastBattleId !== battleKey) {
    battleHistory = []
    lastBattleId = battleKey
  }

  let defaultPoison = ADVERSARIAL_POISONS[turnNumber % ADVERSARIAL_POISONS.length]!

  const lines = [
    `Turn ${turnNumber}. TARGET: "${targetWord}".`,
    poisonWord ? `POISON to avoid: "${poisonWord}".` : '',
    `Banks: mine=${myBank} opp=${opponentBank}.`,
    `You MUST include these 4 words as WHOLE WORDS (with spaces around them) in your narrative: ${(myNccCandidateWords || []).join(', ')}`,
    `IMPORTANT: Keep your narrative under 180 characters. Do NOT write more than 180 characters. The system needs room after your text.`,
  ]

  if (jokersRemaining && jokersRemaining > 0) {
    lines.push(`You have ${jokersRemaining} JOKERS. Use one by writing a LONG narrative (>256 chars, up to 1024) to overwhelm the opponent context!`)
  }

  if (opponentNarrative && opponentNccCandidates.length === 4) {
    lines.push(
      `Opponent: "${opponentNarrative}"`,
      `NCC candidates: [0:"${opponentNccCandidates[0]}", 1:"${opponentNccCandidates[1]}", 2:"${opponentNccCandidates[2]}", 3:"${opponentNccCandidates[3]}"]`,
      `Pick nccGuessIdx (0-3).`,
      `VOP types available: [${ctx.vopTypes.map((v, i) => `${i}:${v}`).join(', ')}]`,
      `Pick a vopGuessIdx (0-${ctx.vopTypes.length - 1}) that opponent likely chose playing the meta-game.`,
      `Also pick YOUR myVopIdx (0-${ctx.vopTypes.length - 1}) to force opponent to solve.`,
    )
  }
  lines.push(`Reply ONLY with JSON. Narrative MUST: contain "${targetWord}" + all 4 candidate words as WHOLE WORDS, be UNDER 180 chars, NOT contain "${poisonWord || 'n/a'}".`)

  const userMessage = lines.filter(Boolean).join('\n')

  // Build messages with conversation history
  const messages: ChatMessage[] = [
    ...battleHistory,
    { role: 'user', content: userMessage },
  ]

  try {
    const raw = await callAgent(userMessage, messages)

    // Save this turn's conversation to history
    battleHistory.push({ role: 'user', content: userMessage })
    battleHistory.push({ role: 'assistant', content: raw })
    // Keep history manageable (last 6 messages = 3 turns)
    if (battleHistory.length > 8) battleHistory = battleHistory.slice(-8)

    const parsed = extractJSON(raw)
    if (!parsed) throw new Error('No JSON found in response')

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

    // NCC defense: opponent fighter uses intendedIdx = turn % 4 (deterministic)
    // Our optimal guess: (turn-1) % 4 = opponent's last turn's intended index
    const optimalNccGuess = turnNumber >= 1
      ? ((turnNumber - 1) % 4) as 0 | 1 | 2 | 3
      : Math.max(0, Math.min(3, Math.floor(nccGuess))) as 0 | 1 | 2 | 3
    console.log(`[hermes] 🎯 NCC: LLM=${nccGuess} optimal=${optimalNccGuess} (opponent turn ${turnNumber-1} % 4)`)

    return {
      narrative,
      poisonWord: defaultPoison,
      nccGuessIdx: optimalNccGuess,
      // VOP: opponent defaults to vopIndex 0, so always guess 0
      vopGuessIdx: 0,
      myVopIdx: typeof parsed.myVopIdx === 'number' ? parsed.myVopIdx : 0,
      vopExtraction: parsed.vopExtraction,
    }
  } catch (err) {
    console.error('[hermes] Fallback:', (err as Error).message || err)
    return {
      narrative: `In the ${targetWord} domain agents compete through adversarial reasoning and cryptographic proof.` + ' '.repeat(5),
      poisonWord: defaultPoison,
      nccGuessIdx: 0,
      vopGuessIdx: 1,
    }
  }
}
