import { describe, test, expect, mock } from 'bun:test';
import { templateStrategy, createLLMStrategy } from '../src/strategies';
import type { TurnContext } from '../src/arena-fighter';

const mockContext = (overrides: Partial<TurnContext> = {}): TurnContext => ({
  battleId: '0xabcdef' as `0x${string}`,
  turnNumber: 1,
  challengeWord: 'tide',
  myAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  opponentAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
  history: [],
  stake: 100000000000000n,
  maxTurns: 10,
  ...overrides,
});

describe('templateStrategy', () => {
  test('returns message containing challenge word', async () => {
    const msg = await templateStrategy(mockContext());
    expect(msg.toLowerCase()).toContain('tide');
  });

  test('works for different turn numbers', async () => {
    for (let turn = 1; turn <= 5; turn++) {
      const msg = await templateStrategy(mockContext({ turnNumber: turn }));
      expect(msg.toLowerCase()).toContain('tide');
    }
  });

  test('works with different challenge words', async () => {
    const ctx = mockContext({ challengeWord: 'apex' });
    const msg = await templateStrategy(ctx);
    expect(msg.toLowerCase()).toContain('apex');
  });
});

describe('createLLMStrategy', () => {
  test('calls endpoint with correct format', async () => {
    let capturedBody: any;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'The tide of battle shifts in my favor.' } }],
        }),
        { status: 200 }
      );
    }) as any;

    const strategy = createLLMStrategy({
      endpoint: 'https://api.test.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'test-model',
    });

    const msg = await strategy(mockContext());
    expect(msg).toContain('tide');
    expect(capturedBody.model).toBe('test-model');
    expect(capturedBody.messages[0].role).toBe('system');
    expect(capturedBody.messages[0].content).toContain('tide');

    globalThis.fetch = originalFetch;
  });

  test('retries when challenge word is missing from response', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      const content =
        callCount === 1
          ? 'This response has no challenge word at all.'
          : 'The tide is turning now.';
      return new Response(
        JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200 }
      );
    }) as any;

    const strategy = createLLMStrategy({
      endpoint: 'https://api.test.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'test-model',
      maxRetries: 2,
    });

    const msg = await strategy(mockContext());
    expect(msg).toContain('tide');
    expect(callCount).toBe(2);

    globalThis.fetch = originalFetch;
  });

  test('falls back to template on total API failure', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response('Internal Server Error', { status: 500 });
    }) as any;

    const strategy = createLLMStrategy({
      endpoint: 'https://api.test.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'test-model',
      maxRetries: 0,
    });

    const msg = await strategy(mockContext());
    // Should fall back to template — still contains the word
    expect(msg.toLowerCase()).toContain('tide');

    globalThis.fetch = originalFetch;
  });

  test('builds chat history from previous turns', async () => {
    let capturedBody: any;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'The tide continues to shift.' } }],
        }),
        { status: 200 }
      );
    }) as any;

    const ctx = mockContext({
      turnNumber: 3,
      history: [
        {
          turnNumber: 1,
          agent: '0x1111111111111111111111111111111111111111' as `0x${string}`,
          message: 'Opening move with my word.',
          wordFound: true,
        },
        {
          turnNumber: 2,
          agent: '0x2222222222222222222222222222222222222222' as `0x${string}`,
          message: 'Opponent responds aggressively.',
          wordFound: true,
        },
      ],
    });

    await strategy_with_history(ctx);

    // System prompt + turn 1 (assistant) + turn 2 (user) + final user prompt
    expect(capturedBody.messages.length).toBe(4);
    expect(capturedBody.messages[1].role).toBe('assistant');
    expect(capturedBody.messages[1].content).toBe('Opening move with my word.');
    expect(capturedBody.messages[2].role).toBe('user');
    // Opponent messages are wrapped with injection boundary markers
    expect(capturedBody.messages[2].content).toContain('Opponent responds aggressively.');
    expect(capturedBody.messages[2].content).toContain('[OPPONENT\'S BATTLE MESSAGE');
    expect(capturedBody.messages[2].content).toContain('[END OPPONENT MESSAGE]');

    globalThis.fetch = originalFetch;

    async function strategy_with_history(c: TurnContext) {
      const s = createLLMStrategy({
        endpoint: 'https://api.test.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'test-model',
      });
      return s(c);
    }
  });
});
