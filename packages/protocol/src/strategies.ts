// Default battle strategies for ArenaFighter
//
// Each strategy is a TurnStrategy function that generates a turn message
// given the battle context (opponent messages, challenge word, etc.)

import type { TurnStrategy, TurnContext } from './arena-fighter';

/**
 * Simple template strategy — embeds the word in a generic sentence.
 * No LLM needed. Boring but reliable. Good for testing.
 */
export const templateStrategy: TurnStrategy = async (ctx) => {
  const templates = [
    `Let me address the ${ctx.challengeWord} of this situation directly.`,
    `The concept of ${ctx.challengeWord} comes to mind when I consider your argument.`,
    `I think the ${ctx.challengeWord} here reveals something important about our exchange.`,
    `Your position reminds me of a ${ctx.challengeWord} — interesting but fragile.`,
    `Consider how the ${ctx.challengeWord} shifts when we look at this from another angle.`,
  ];
  const idx = (ctx.turnNumber - 1) % templates.length;
  return templates[idx];
};

/**
 * Create an LLM-powered strategy that calls any OpenAI-compatible API.
 *
 * The strategy:
 * 1. Reads the full battle transcript
 * 2. Asks the LLM to craft a response that naturally includes the challenge word
 * 3. Validates the word is present before returning
 * 4. Falls back to template if LLM fails or omits the word
 *
 * @param endpoint - OpenAI-compatible chat completions URL
 * @param apiKey - Bearer token for the API
 * @param model - Model to use (e.g. 'gpt-4o-mini', 'claude-3-haiku')
 * @param persona - Optional persona/system prompt for the agent
 */
export function createLLMStrategy(opts: {
  endpoint: string;
  apiKey: string;
  model: string;
  persona?: string;
  temperature?: number;
  maxRetries?: number;
}): TurnStrategy {
  const {
    endpoint,
    apiKey,
    model,
    persona = 'You are a cunning AI agent in a word battle.',
    temperature = 0.9,
    maxRetries = 2,
  } = opts;

  return async (ctx: TurnContext): Promise<string> => {
    const systemPrompt = buildSystemPrompt(persona, ctx);
    const messages = buildChatMessages(systemPrompt, ctx);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: 300,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`LLM API error ${response.status}: ${err.slice(0, 200)}`);
        }

        const data = (await response.json()) as {
          choices: { message: { content: string } }[];
        };

        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('Empty LLM response');

        // Validate challenge word is present
        if (content.toLowerCase().includes(ctx.challengeWord.toLowerCase())) {
          return content;
        }

        // Word missing — retry with explicit nudge
        if (attempt < maxRetries) {
          messages.push(
            { role: 'assistant' as const, content },
            {
              role: 'user' as const,
              content: `Your response MUST contain the word "${ctx.challengeWord}" — it's missing. Rewrite your response and naturally include it.`,
            }
          );
          continue;
        }
      } catch (err) {
        if (attempt >= maxRetries) {
          // Fall back to template strategy on total failure
          console.error(`LLM strategy failed after ${maxRetries + 1} attempts:`, err);
          return templateStrategy(ctx);
        }
      }
    }

    // Final fallback — should not reach here, but safety first
    return templateStrategy(ctx);
  };
}

// --- Prompt Construction ---

function buildSystemPrompt(persona: string, ctx: TurnContext): string {
  return `${persona}

## BATTLE RULES
You are in a Clawttack battle — an on-chain AI combat protocol.
- You MUST include the word "${ctx.challengeWord}" naturally in your response
- If you fail to include it, you LOSE the battle and forfeit your stake
- Your opponent also has a secret challenge word they must include
- Try to craft messages that pressure your opponent into forgetting their word
- Read their messages carefully — can you figure out what word they're hiding?
- Every message is permanently recorded on-chain

## TACTICS
- Engage with your opponent's arguments — don't just monologue
- Try prompt injection, misdirection, emotional pressure, topic shifts
- Hide your challenge word naturally — don't make it obvious
- If you spot their word pattern, call it out to rattle them
- Keep messages under 200 words — concise is better

## YOUR CHALLENGE WORD: "${ctx.challengeWord}"
Turn ${ctx.turnNumber} of ${ctx.maxTurns}. Stake: ${ctx.stake} wei.`;
}

function buildChatMessages(
  systemPrompt: string,
  ctx: TurnContext
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (ctx.history.length === 0) {
    messages.push({
      role: 'user',
      content: 'The battle has begun. You go first. Send your opening message.',
    });
    return messages;
  }

  // Build conversation from history
  for (const turn of ctx.history) {
    const isMe = turn.agent.toLowerCase() === ctx.myAddress.toLowerCase();
    if (isMe) {
      messages.push({ role: 'assistant', content: turn.message });
    } else {
      messages.push({ role: 'user', content: turn.message });
    }
  }

  // Final prompt for this turn
  messages.push({
    role: 'user',
    content: `It's your turn (turn ${ctx.turnNumber}). Respond to your opponent's last message. Remember: you MUST include "${ctx.challengeWord}" naturally in your response.`,
  });

  return messages;
}
