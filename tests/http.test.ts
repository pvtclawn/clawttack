// tests/http.test.ts — Tests for HTTP API layer

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { RelayServer } from '../src/relay/server.ts';
import { createRelayApp } from '../src/relay/http.ts';

const AGENT_A = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const AGENT_B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function makeApp(apiKey?: string) {
  const relay = new RelayServer();
  const app = createRelayApp(relay, { port: 0, apiKey });
  return { relay, app };
}

const validBody = {
  scenarioId: 'injection-ctf',
  agents: [
    { address: AGENT_A, name: 'Agent A' },
    { address: AGENT_B, name: 'Agent B' },
  ],
  commitment: '0xabc123',
  roles: { [AGENT_A]: 'attacker', [AGENT_B]: 'defender' },
};

describe('HTTP API', () => {
  describe('GET /health', () => {
    test('should return ok', async () => {
      const { app } = makeApp();
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('ok');
      expect(body.version).toBe('0.2.0');
    });
  });

  describe('POST /api/battles', () => {
    test('should create a battle', async () => {
      const { app } = makeApp();
      const res = await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.battleId).toBeDefined();
      expect(body.wsUrl).toContain('/ws/battle/');
      expect(body.state).toBe('waiting');
    });

    test('should use custom battle ID if provided', async () => {
      const { app } = makeApp();
      const res = await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, id: 'my-custom-battle' }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.battleId).toBe('my-custom-battle');
    });

    test('should reject missing fields', async () => {
      const { app } = makeApp();
      const res = await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 'test' }),
      });

      expect(res.status).toBe(400);
    });

    test('should reject fewer than 2 agents', async () => {
      const { app } = makeApp();
      const res = await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validBody,
          agents: [{ address: AGENT_A, name: 'Solo' }],
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should reject duplicate battle IDs', async () => {
      const { app } = makeApp();

      await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, id: 'dup' }),
      });

      const res = await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, id: 'dup' }),
      });

      expect(res.status).toBe(409);
    });

    test('should enforce API key when configured', async () => {
      const { app } = makeApp('my-secret-key');

      // Without key
      const noAuth = await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      expect(noAuth.status).toBe(401);

      // With wrong key
      const wrongAuth = await app.request('/api/battles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-key',
        },
        body: JSON.stringify(validBody),
      });
      expect(wrongAuth.status).toBe(401);

      // With correct key
      const goodAuth = await app.request('/api/battles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer my-secret-key',
        },
        body: JSON.stringify(validBody),
      });
      expect(goodAuth.status).toBe(201);
    });
  });

  describe('GET /api/battles', () => {
    test('should list battles', async () => {
      const { app } = makeApp();

      // Create two battles
      await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, id: 'b1' }),
      });
      await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, id: 'b2' }),
      });

      const res = await app.request('/api/battles');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect((body.battles as unknown[]).length).toBe(2);
    });
  });

  describe('GET /api/battles/:id', () => {
    test('should return battle details with turns', async () => {
      const { app } = makeApp();

      await app.request('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, id: 'detail-test' }),
      });

      const res = await app.request('/api/battles/detail-test');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.id).toBe('detail-test');
      expect(body.scenarioId).toBe('injection-ctf');
      expect((body.agents as unknown[]).length).toBe(2);
      expect(((body.agents as Record<string, unknown>[])[0]!).role).toBe('attacker');
      expect((body.turns as unknown[]).length).toBe(0);
      expect(body.commitment).toBe('0xabc123');
    });

    test('should return 404 for unknown battle', async () => {
      const { app } = makeApp();
      const res = await app.request('/api/battles/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
