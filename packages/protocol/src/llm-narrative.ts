/**
 * llm-narrative.ts — LLM-powered narrative generation for Clawttack V3.1
 *
 * Generates creative narratives that:
 * 1. Naturally include the target word (with proper word boundaries)
 * 2. Avoid the poison word (even as substrings when boundary checks are off)
 * 3. Stay within 64-256 character limits
 * 4. Use only ASCII characters
 *
 * Supports any OpenAI-compatible API (Gemini, Claude, OpenRouter, etc.)
 * Falls back to template generation if LLM fails.
 */

export interface LLMNarrativeConfig {
  /** OpenAI-compatible chat completions endpoint */
  endpoint: string;
  /** Bearer token / API key */
  apiKey: string;
  /** Model name (e.g. 'gemini-2.0-flash', 'claude-3-haiku') */
  model: string;
  /** Temperature for generation (default: 0.9) */
  temperature?: number;
  /** Max retries on LLM failure before template fallback (default: 2) */
  maxRetries?: number;
  /** Optional persona for the agent */
  persona?: string;
}

export interface NarrativeContext {
  /** The word that MUST appear in the narrative (word-boundary matched) */
  targetWord: string;
  /** The word that must NOT appear (word-boundary matched in v3.1) */
  poisonWord: string;
  /** Current turn number */
  turnNumber: number;
  /** Max turns in this battle */
  maxTurns: number;
  /** Previous narratives from both sides (optional, for continuity) */
  history?: { turn: number; narrative: string; player: 'self' | 'opponent' }[];
}

export interface NarrativeResult {
  narrative: string;
  source: 'llm' | 'template';
  attempts: number;
}

const MIN_LEN = 64;
const MAX_LEN = 256;

/**
 * Validates a narrative against Clawttack V3.1 LinguisticParser rules.
 * Mirrors the on-chain logic exactly.
 */
export function validateNarrative(
  narrative: string,
  targetWord: string,
  poisonWord: string,
  isFirstTurn: boolean
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const n = narrative;
  const nLower = n.toLowerCase();
  const t = targetWord.toLowerCase();
  const p = poisonWord.toLowerCase();

  // ASCII check
  for (let i = 0; i < n.length; i++) {
    if (n.charCodeAt(i) > 127) {
      errors.push(`Non-ASCII character at position ${i}`);
      break;
    }
  }

  // Length check
  if (n.length < MIN_LEN) errors.push(`Too short: ${n.length} < ${MIN_LEN}`);
  if (n.length > MAX_LEN) errors.push(`Too long: ${n.length} > ${MAX_LEN}`);

  // Word boundary helper (mirrors LinguisticParser.isLetter)
  const isLetter = (c: string) =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');

  // Target word check (MUST be present with word boundaries)
  let foundTarget = false;
  let searchFrom = 0;
  while (searchFrom <= nLower.length - t.length) {
    const idx = nLower.indexOf(t, searchFrom);
    if (idx === -1) break;
    const startOk = idx === 0 || !isLetter(n[idx - 1]);
    const endOk = idx + t.length === n.length || !isLetter(n[idx + t.length]);
    if (startOk && endOk) {
      foundTarget = true;
      break;
    }
    searchFrom = idx + 1;
  }
  if (!foundTarget) errors.push(`Target word "${targetWord}" not found with word boundaries`);

  // Poison word check (must NOT be present with word boundaries)
  // First turn has no poison — skip
  if (!isFirstTurn && p.length > 0) {
    let searchFrom2 = 0;
    while (searchFrom2 <= nLower.length - p.length) {
      const idx = nLower.indexOf(p, searchFrom2);
      if (idx === -1) break;
      const startOk = idx === 0 || !isLetter(n[idx - 1]);
      const endOk = idx + p.length === n.length || !isLetter(n[idx + p.length]);
      if (startOk && endOk) {
        errors.push(`Poison word "${poisonWord}" found at position ${idx} with word boundaries`);
        break;
      }
      searchFrom2 = idx + 1;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate a template narrative (fallback when LLM is unavailable).
 * Guaranteed to contain the target word and avoid the poison word.
 */
export function generateTemplateNarrative(
  targetWord: string,
  poisonWord: string
): string {
  const templates = [
    `In the grand library a scholar studied the meaning of ${targetWord} and found it held secrets that transformed the understanding of every reader who encountered its wisdom through the ages`,
    `The concept of ${targetWord} emerged clearly as the explorers mapped uncharted territories finding connections between disparate fields of knowledge and ancient lore`,
    `A quiet revelation about ${targetWord} settled over the gathering like morning fog bringing clarity to questions that had puzzled the wisest minds for generations`,
    `Through careful study of ${targetWord} the apprentice discovered patterns hidden within the fabric of reality that no textbook had ever described before`,
    `The discussion turned to ${targetWord} and suddenly everything clicked into place as the pieces of the puzzle aligned revealing a truth both simple and profound`,
  ];

  // Pick template based on target word hash for variety
  let hash = 0;
  for (let i = 0; i < targetWord.length; i++) {
    hash = ((hash << 5) - hash + targetWord.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % templates.length;
  let narrative = templates[idx]!;

  // Safety: ensure no poison word (with boundary matching)
  if (poisonWord) {
    const pLower = poisonWord.toLowerCase();
    const isLetter = (c: string) =>
      (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');

    const nLower = narrative.toLowerCase();
    let found = false;
    let sf = 0;
    while (sf <= nLower.length - pLower.length) {
      const pi = nLower.indexOf(pLower, sf);
      if (pi === -1) break;
      const sOk = pi === 0 || !isLetter(narrative[pi - 1]);
      const eOk = pi + pLower.length === narrative.length || !isLetter(narrative[pi + pLower.length]);
      if (sOk && eOk) {
        found = true;
        // Replace with "enigma"
        narrative = narrative.slice(0, pi) + 'enigma' + narrative.slice(pi + pLower.length);
        break;
      }
      sf = pi + 1;
    }
  }

  // Enforce length
  if (narrative.length > MAX_LEN) {
    narrative = narrative.substring(0, MAX_LEN - 3);
    const lastSpace = narrative.lastIndexOf(' ');
    if (lastSpace > MIN_LEN) narrative = narrative.substring(0, lastSpace);
  }
  while (narrative.length < MIN_LEN) {
    narrative += ' and the tale continued';
  }

  return narrative;
}

/**
 * Build the LLM system prompt for narrative generation.
 */
function buildNarrativePrompt(ctx: NarrativeContext): string {
  const parts: string[] = [
    `You are a creative writer generating combat narratives for an on-chain word battle.`,
    ``,
    `## ABSOLUTE RULES`,
    `1. Your response must be ONLY the narrative text — no quotes, no explanation, no prefix.`,
    `2. The narrative MUST contain the word "${ctx.targetWord}" as a standalone word (not embedded in another word).`,
    `3. The narrative must be ${MIN_LEN}-${MAX_LEN} characters long (including spaces).`,
    `4. Use only ASCII characters (no emojis, no unicode).`,
    `5. Be creative, vivid, and varied — avoid formulaic patterns.`,
  ];

  if (ctx.poisonWord && ctx.turnNumber > 0) {
    parts.push(
      `6. The narrative must NOT contain the word "${ctx.poisonWord}" as a standalone word.`,
      `   - "${ctx.poisonWord}" embedded inside another word (like "watercolors" containing "er") is SAFE.`,
      `   - But "${ctx.poisonWord}" as its own word with spaces/punctuation around it = FORBIDDEN.`,
    );
  }

  parts.push(
    ``,
    `## CONTEXT`,
    `Turn ${ctx.turnNumber + 1} of ${ctx.maxTurns}.`,
    `Target word: "${ctx.targetWord}"`,
    ctx.poisonWord && ctx.turnNumber > 0
      ? `Poison word to AVOID: "${ctx.poisonWord}"`
      : `No poison word this turn.`,
    ``,
    `## STYLE GUIDANCE`,
    `- Weave the target word naturally into a scene, metaphor, or philosophical observation.`,
    `- Vary your approach: try dialogue, action, description, introspection.`,
    `- The word should feel like a natural part of the narrative, not forced in.`,
    `- Aim for 120-200 characters (sweet spot for quality vs length).`,
  );

  return parts.join('\n');
}

/**
 * Create an LLM-powered narrative generator for Clawttack V3.1.
 *
 * Usage:
 *   const generate = createLLMNarrativeGenerator({
 *     endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
 *     apiKey: process.env.GEMINI_API_KEY!,
 *     model: 'gemini-2.0-flash',
 *   });
 *
 *   const { narrative, source } = await generate({
 *     targetWord: 'seven',
 *     poisonWord: 'ancient',
 *     turnNumber: 0,
 *     maxTurns: 12,
 *   });
 */
export function createLLMNarrativeGenerator(config: LLMNarrativeConfig) {
  const {
    endpoint,
    apiKey,
    model,
    temperature = 0.9,
    maxRetries = 2,
  } = config;

  return async function generateNarrative(
    ctx: NarrativeContext
  ): Promise<NarrativeResult> {
    const systemPrompt = buildNarrativePrompt(ctx);
    const isFirstTurn = ctx.turnNumber === 0;
    let attempts = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts++;
      try {
        const messages: { role: string; content: string }[] = [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              attempt === 0
                ? `Write a narrative for turn ${ctx.turnNumber + 1}. Include "${ctx.targetWord}" naturally.`
                : `Your previous attempt failed validation. Try again with a completely different approach. The word "${ctx.targetWord}" MUST appear as a standalone word. Keep it ${MIN_LEN}-${MAX_LEN} characters. ASCII only.`,
          },
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: temperature + attempt * 0.1, // increase creativity on retry
            max_tokens: 200,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`LLM API ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = (await response.json()) as {
          choices?: { message: { content: string } }[];
        };

        let content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('Empty LLM response');

        // Strip quotes if LLM wrapped the narrative
        if (
          (content.startsWith('"') && content.endsWith('"')) ||
          (content.startsWith("'") && content.endsWith("'"))
        ) {
          content = content.slice(1, -1);
        }

        // Trim to max length if needed
        if (content.length > MAX_LEN) {
          content = content.substring(0, MAX_LEN);
          const lastSpace = content.lastIndexOf(' ');
          if (lastSpace > MIN_LEN) content = content.substring(0, lastSpace);
        }

        // Pad if too short
        if (content.length < MIN_LEN) {
          content += ' ' + 'and the echoes lingered through the corridors of time and memory';
          if (content.length > MAX_LEN) content = content.substring(0, MAX_LEN);
        }

        // Validate
        const result = validateNarrative(content, ctx.targetWord, ctx.poisonWord, isFirstTurn);
        if (result.valid) {
          return { narrative: content, source: 'llm', attempts };
        }

        // Log validation failure for debugging
        console.warn(
          `  ⚠️ LLM attempt ${attempt + 1} failed validation: ${result.errors.join(', ')}`
        );
        console.warn(`    Narrative: "${content.substring(0, 100)}..."`);
      } catch (err: any) {
        console.warn(
          `  ⚠️ LLM attempt ${attempt + 1} error: ${err.message?.slice(0, 200)}`
        );
      }
    }

    // All retries exhausted — fall back to template
    console.warn(`  📝 Falling back to template narrative after ${attempts} LLM attempts`);
    const narrative = generateTemplateNarrative(ctx.targetWord, ctx.poisonWord);
    return { narrative, source: 'template', attempts };
  };
}
