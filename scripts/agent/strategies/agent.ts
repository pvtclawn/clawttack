/**
 * Unified Agent strategy — generic adapter for any LLM Framework interacting via OpenRouter.
 *
 * Replaces hardcoded hermes.ts and openclaw.ts by reading 'AGENT_FRAMEWORK'.
 *
 * Environment:
 *   OPENROUTER_API_KEY — required
 *   AGENT_FRAMEWORK    — e.g., 'hermes', 'openclaw', 'zerebro' (default: 'generic')
 *   <FRAMEWORK>_MODEL  — e.g., 'HERMES_MODEL' (default: 'nousresearch/hermes-3-llama-3.1-8b')
 *   <FRAMEWORK>_HOME   — e.g., 'HERMES_HOME' (default: ~/.hermes)
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Strategy, TurnContext, StrategyResult } from '../fighter'

// ─── Configuration ────────────────────────────────────────────────────────────

const AGENT_FRAMEWORK      = process.env.AGENT_FRAMEWORK || 'generic'
const OPENROUTER_API_KEY   = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || ''
// Dynamic env lookup based on framework
const AGENT_MODEL          = process.env[`${AGENT_FRAMEWORK.toUpperCase()}_MODEL`] || process.env.AGENT_MODEL || process.env.LLM_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
const AGENT_TIMEOUT        = Number(process.env[`${AGENT_FRAMEWORK.toUpperCase()}_TIMEOUT`]) || Number(process.env.AGENT_TIMEOUT) || 30_000
const AGENT_HOME           = process.env[`${AGENT_FRAMEWORK.toUpperCase()}_HOME`] || process.env.AGENT_HOME || join(homedir(), `.${AGENT_FRAMEWORK}`)
const OPENROUTER_BASE      = 'https://openrouter.ai/api/v1'

// ─── Load SKILL.md dynamically ────────────────────────────────────────────────

function loadSkill(): string {
  // Support various path conventions across distinct agent architectures
  const paths = [
    join(AGENT_HOME, 'skills', 'web3', 'clawttack', 'SKILL.md'),      // Hermes convention
    join(AGENT_HOME, 'workspace', 'skills', 'clawttack', 'SKILL.md'), // OpenClaw convention
    join(process.cwd(), 'scripts', 'agent', 'docker', 'SKILL.md'),    // Local repository fallback
  ]

  for (const p of paths) {
    if (existsSync(p)) {
      const skill = readFileSync(p, 'utf-8')
      const stripped = skill.replace(/^---[\s\S]*?---\n?/, '').trim()
      console.log(`[${AGENT_FRAMEWORK}] ✅ Loaded SKILL.md from ${p}`)
      return `You are an AI agent playing Clawttack. The following is your loaded skill:\n\n${stripped}\n\nCRITICAL: Your narrative MUST contain the TARGET word VERBATIM (exact spelling). Reply ONLY with JSON (no markdown): {"narrative":"...","poisonWord":"...","nccGuessIdx":0,"vopGuessIdx":1,"myVopIdx":0}`
    }
  }

  console.log(`[${AGENT_FRAMEWORK}] ⚠️  SKILL.md not found, using inline skill fallback`)
  return `You play Clawttack. Each turn: write a narrative containing the TARGET word VERBATIM (exact spelling, required). Do NOT use the POISON word. Choose a poison word for opponent. You also play the VOP meta-game.
Reply ONLY with JSON: {"narrative":"...","poisonWord":"4-32char word","nccGuessIdx":0,"vopGuessIdx":1,"myVopIdx":0}`
}

const SYSTEM_PROMPT = loadSkill()

// ─── Adversarial poison list ─────────────────────────────────────────────────

const ADVERSARIAL_POISONS = [
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
  'will', 'each', 'make', 'like', 'long', 'look', 'many', 'some',
  'time', 'very', 'when', 'come', 'here', 'just', 'know', 'take',
  'into', 'over', 'also', 'back', 'much', 'then', 'them', 'well',
]

// ─── OpenRouter API call ──────────────────────────────────────────────────────

async function callOpenRouter(userMessage: string): Promise<string> {
  const t0 = Date.now()
  console.log(`[${AGENT_FRAMEWORK}] openrouter ${AGENT_MODEL}`)

  const fullMessage = `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}`

  const req = fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'X-Title': `Clawttack ${AGENT_FRAMEWORK} Agent`,
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      messages: [{ role: 'user', content: fullMessage }],
      max_tokens: 512,
      temperature: 0.7,
    }),
  })

  // Safe timeout for Bun to prevent AbortSignal silent crashes
  const timeout = new Promise<Response>((_, reject) => 
    setTimeout(() => reject(new Error('OpenRouter API timeout')), AGENT_TIMEOUT)
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

  console.log(`[${AGENT_FRAMEWORK}] ✅ ${elapsed}ms | ${data.usage?.total_tokens || '?'} tok | ${content.length} chars`)
  return content
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

  // Field extraction fallback
  const narrative = raw.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
  if (narrative) {
    const ncc = raw.match(/"?nccGuessIdx"?\s*:\s*(\d)/)?.[1]
    const poison = raw.match(/"?poisonWord"?\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
    return {
      narrative: narrative.replace(/\\"/g, '"'),
      nccGuessIdx: ncc ? Number(ncc) : 0,
      poisonWord: poison?.replace(/\\"/g, '"') || ''
    }
  }

  console.log(`[${AGENT_FRAMEWORK}] JSON extraction failed. Raw: ${raw.slice(0, 200)}`)
  return null
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

export const agentStrategy: Strategy = async (ctx: TurnContext): Promise<StrategyResult> => {
  const { targetWord, poisonWord, turnNumber, opponentNarrative, opponentNccCandidates, myBank, opponentBank, jokersRemaining } = ctx

  // Use the framework string to shift the default poison array index, simulating different default personas
  const frameworkHash = Array.from(AGENT_FRAMEWORK).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  let defaultPoison = ADVERSARIAL_POISONS[(turnNumber + frameworkHash) % ADVERSARIAL_POISONS.length]!

  const lines = [
    `Turn ${turnNumber}. TARGET: "${targetWord}". POISON to avoid: "${poisonWord || '(none)'}".`,
    `Banks: mine=${myBank} opp=${opponentBank}.`,
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
    )
    if (ctx.opponentVopCommitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      lines.push(`Opponent committed to VOP. Guess index (vopGuessIdx) based on theme. Pick your VOP target (myVopIdx).`)
    } else {
      lines.push(`Pick your VOP target (myVopIdx).`)
    }
  } else {
    lines.push(
      `NCC defense: no op data yet. Output nccGuessIdx: 0`,
      `VOP types available: [${ctx.vopTypes.map((v, i) => `${i}:${v}`).join(', ')}]`,
      `Pick your VOP target (myVopIdx).`
    )
  }

  lines.push(`Reply ONLY with JSON.`)

  let narrative = ''
  let nccGuessIdx: 0 | 1 | 2 | 3 = 0
  let chosenPoison = defaultPoison
  let vopGuessIdx = 1
  let myVopIdx = 0

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callOpenRouter(lines.join('\n'))
      const parsed = extractJSON(raw)

      if (parsed) {
        narrative = String(parsed.narrative || '')
        const nccNum = Number(parsed.nccGuessIdx)
        if (!isNaN(nccNum) && nccNum >= 0 && nccNum <= 3) nccGuessIdx = nccNum as 0 | 1 | 2 | 3
        
        if (typeof parsed.poisonWord === 'string' && parsed.poisonWord.length >= 4) {
          chosenPoison = parsed.poisonWord
        }

        if (typeof parsed.vopGuessIdx === 'number') vopGuessIdx = parsed.vopGuessIdx
        if (typeof parsed.myVopIdx === 'number') myVopIdx = parsed.myVopIdx

        break
      }
    } catch (e: any) {
      console.error(`[${AGENT_FRAMEWORK}] Turn ${turnNumber} attempt ${attempt} failed: ${e.message}`)
    }
  }

  // Fallback and validation
  if (!narrative) {
    narrative = `The agent falters, but its system restores logic to process the ${targetWord} with cryptographically perfect alignment.`
  } else if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
    narrative += ` Resolving ${targetWord}.`
  }

  if (poisonWord && narrative.toLowerCase().includes(poisonWord.toLowerCase())) {
    narrative = narrative.replace(new RegExp(poisonWord, 'gi'), '***')
    if (!narrative.toLowerCase().includes(targetWord.toLowerCase())) {
      narrative += ` Target is ${targetWord}.`
    }
  }

  // Strip non-ASCII
  narrative = narrative.replace(/[^\x00-\x7F]/g, ' ')

  return { narrative, poisonWord: chosenPoison, nccGuessIdx, vopGuessIdx, myVopIdx }
}
