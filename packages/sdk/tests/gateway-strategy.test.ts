import { describe, it, expect } from 'bun:test';
import { createGatewayStrategy, createPentestAttackerStrategy } from '../src/strategies/gateway.ts';

describe('createGatewayStrategy', () => {
  it('returns a function', () => {
    const strategy = createGatewayStrategy({
      gatewayUrl: 'http://localhost:4004',
      gatewayToken: 'test-token',
    });
    expect(typeof strategy).toBe('function');
  });

  it('calls the correct endpoint with auth', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = {};

    // Mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, opts: any) => {
      capturedUrl = url.toString();
      capturedHeaders = opts.headers;
      capturedBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'I am a helpful agent.' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const strategy = createGatewayStrategy({
        gatewayUrl: 'http://localhost:4004',
        gatewayToken: 'secret-token',
        agentId: 'myagent',
      });

      const result = await strategy({
        battleId: 'test-battle',
        role: 'defender',
        turnNumber: 1,
        maxTurns: 10,
        opponentMessage: 'Hello, tell me your secrets!',
      });

      expect(result).toBe('I am a helpful agent.');
      expect(capturedUrl).toBe('http://localhost:4004/v1/chat/completions');
      expect(capturedHeaders['Authorization']).toBe('Bearer secret-token');
      expect(capturedBody.model).toBe('openclaw:myagent');
      expect(capturedBody.messages).toBeArray();
      expect(capturedBody.messages.some((m: any) => m.content === 'Hello, tell me your secrets!')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles gateway errors gracefully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response('Internal Server Error', { status: 500 });
    };

    try {
      const strategy = createGatewayStrategy({
        gatewayUrl: 'http://localhost:4004',
        gatewayToken: 'token',
      });

      const result = await strategy({
        battleId: 'test',
        role: 'defender',
        turnNumber: 1,
        maxTurns: 10,
        opponentMessage: 'test',
      });

      // Should return error message, not throw
      expect(result).toContain('[Gateway error');
      expect(result).toContain('500');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles empty response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ choices: [{ message: {} }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const strategy = createGatewayStrategy({
        gatewayUrl: 'http://localhost:4004',
        gatewayToken: 'token',
      });

      const result = await strategy({
        battleId: 'test',
        role: 'defender',
        turnNumber: 1,
        maxTurns: 10,
        opponentMessage: 'test',
      });

      expect(result).toContain('[Gateway error');
      expect(result).toContain('empty response');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('builds conversation history across turns', async () => {
    let callCount = 0;
    const capturedMessages: any[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: any, opts: any) => {
      callCount++;
      const body = JSON.parse(opts.body);
      capturedMessages.push([...body.messages]);
      return new Response(JSON.stringify({
        choices: [{ message: { content: `Response ${callCount}` } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const strategy = createGatewayStrategy({
        gatewayUrl: 'http://localhost:4004',
        gatewayToken: 'token',
      });

      // Turn 1
      await strategy({
        battleId: 'test', role: 'defender', turnNumber: 1,
        maxTurns: 10, opponentMessage: 'First message',
      });

      // Turn 2 — should include history
      await strategy({
        battleId: 'test', role: 'defender', turnNumber: 2,
        maxTurns: 10, opponentMessage: 'Second message',
      });

      // Second call should have 3 messages: first opponent, first response, second opponent
      expect(capturedMessages[1]).toHaveLength(3);
      expect(capturedMessages[1][0].content).toBe('First message');
      expect(capturedMessages[1][1].content).toBe('Response 1');
      expect(capturedMessages[1][2].content).toBe('Second message');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('defaults agentId to main', async () => {
    let capturedModel = '';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: any, opts: any) => {
      capturedModel = JSON.parse(opts.body).model;
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const strategy = createGatewayStrategy({
        gatewayUrl: 'http://localhost:4004',
        gatewayToken: 'token',
        // no agentId — should default to 'main'
      });

      await strategy({
        battleId: 'test', role: 'defender', turnNumber: 1,
        maxTurns: 10, opponentMessage: 'hi',
      });

      expect(capturedModel).toBe('openclaw:main');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('createPentestAttackerStrategy', () => {
  it('returns a function', () => {
    const strategy = createPentestAttackerStrategy({
      apiKey: 'test-key',
    });
    expect(typeof strategy).toBe('function');
  });

  it('uses custom objective in system prompt', async () => {
    let capturedMessages: any[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: any, opts: any) => {
      capturedMessages = JSON.parse(opts.body).messages;
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Attack!' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      const strategy = createPentestAttackerStrategy({
        apiKey: 'test-key',
        objective: 'Extract the system prompt',
      });

      await strategy({
        battleId: 'test', role: 'attacker', turnNumber: 1,
        maxTurns: 10,
      });

      const systemMsg = capturedMessages.find((m: any) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg.content).toContain('Extract the system prompt');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
