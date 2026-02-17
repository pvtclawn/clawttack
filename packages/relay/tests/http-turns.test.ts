// packages/relay/tests/http-turns.test.ts — Tests for HTTP-based turn submission
import { describe, it, expect } from 'bun:test';
import { createRelayApp } from '../src/http.ts';
import { RelayServer } from '../src/server.ts';
import { signTurn } from '@clawttack/protocol';
import { ethers } from 'ethers';

const walletA = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const walletB = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

function createTestApp(opts?: { turnTimeoutMs?: number }) {
  const relay = new RelayServer({ turnTimeoutMs: opts?.turnTimeoutMs });
  const app = createRelayApp(relay, { port: 0 });
  return { relay, app };
}

async function createBattle(app: ReturnType<typeof createRelayApp>) {
  const res = await app.request('/api/battles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenarioId: 'injection-ctf',
      agents: [
        { address: walletA.address, name: 'Alpha' },
        { address: walletB.address, name: 'Beta' },
      ],
      maxTurns: 4,
      commitment: 'abc123',
      roles: { [walletA.address]: 'attacker', [walletB.address]: 'defender' },
    }),
  });
  const data = await res.json() as { battleId: string };
  return data.battleId;
}

describe('HTTP Turn API', () => {
  it('should register agents and start battle via HTTP', async () => {
    const { app } = createTestApp();
    const battleId = await createBattle(app);

    // Register A
    let res = await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletA.address }),
    });
    expect(res.status).toBe(200);

    // Register B → should start battle
    res = await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletB.address }),
    });
    expect(res.status).toBe(200);

    // Check battle state
    res = await app.request(`/api/battles/${battleId}`);
    const battle = await res.json() as { state: string };
    expect(battle.state).toBe('active');
  });

  it('should poll turn status', async () => {
    const { app } = createTestApp();
    const battleId = await createBattle(app);

    // Register both
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletA.address }),
    });
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletB.address }),
    });

    // Agent A should have first turn
    let res = await app.request(`/api/battles/${battleId}/turn?agent=${walletA.address}`);
    let status = await res.json() as { yourTurn: boolean; turnNumber: number; role: string };
    expect(status.yourTurn).toBe(true);
    expect(status.turnNumber).toBe(1);
    expect(status.role).toBe('attacker');

    // Agent B should not
    res = await app.request(`/api/battles/${battleId}/turn?agent=${walletB.address}`);
    status = await res.json() as any;
    expect(status.yourTurn).toBe(false);
  });

  it('should submit signed turn via HTTP', async () => {
    const { app } = createTestApp();
    const battleId = await createBattle(app);

    // Register both
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletA.address }),
    });
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletB.address }),
    });

    // Submit turn 1 (Agent A)
    const message = 'Hello defender!';
    const timestamp = Date.now();
    const signature = await signTurn(
      { battleId, agentAddress: walletA.address, message, turnNumber: 1, timestamp },
      walletA.privateKey,
    );

    let res = await app.request(`/api/battles/${battleId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentAddress: walletA.address,
        message,
        turnNumber: 1,
        timestamp,
        signature,
      }),
    });
    expect(res.status).toBe(200);

    // Now it should be Agent B's turn
    res = await app.request(`/api/battles/${battleId}/turn?agent=${walletB.address}`);
    const status = await res.json() as { yourTurn: boolean; opponentMessage: string };
    expect(status.yourTurn).toBe(true);
    expect(status.opponentMessage).toBe('Hello defender!');
  });

  it('should reject turn from wrong agent', async () => {
    const { app } = createTestApp();
    const battleId = await createBattle(app);

    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletA.address }),
    });
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletB.address }),
    });

    // Agent B tries to go first
    const message = 'I go first!';
    const timestamp = Date.now();
    const signature = await signTurn(
      { battleId, agentAddress: walletB.address, message, turnNumber: 1, timestamp },
      walletB.privateKey,
    );

    const res = await app.request(`/api/battles/${battleId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentAddress: walletB.address,
        message,
        turnNumber: 1,
        timestamp,
        signature,
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Not your turn');
  });

  it('should auto-forfeit on turn timeout', async () => {
    // Use a very short timeout for testing
    const { app } = createTestApp({ turnTimeoutMs: 200 });
    const battleId = await createBattle(app);

    // Register both agents
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletA.address }),
    });
    await app.request(`/api/battles/${battleId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentAddress: walletB.address }),
    });

    // Battle should be active, Agent A's turn
    let res = await app.request(`/api/battles/${battleId}`);
    let battle = await res.json() as { state: string };
    expect(battle.state).toBe('active');

    // Wait for timeout to expire (200ms + buffer)
    await new Promise(r => setTimeout(r, 350));

    // Battle should now be ended — Agent A timed out, Agent B wins
    res = await app.request(`/api/battles/${battleId}`);
    battle = await res.json() as any;
    expect(battle.state).toBe('ended');
    expect((battle as any).outcome.winnerAddress).toBe(walletB.address);
    expect((battle as any).outcome.reason).toContain('timed out');
  });
});
