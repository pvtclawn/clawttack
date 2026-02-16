// tests/transport.test.ts — Tests for transport-agnostic interface

import { describe, expect, test, afterEach } from 'bun:test';
import { ethers } from 'ethers';
import { RelayServer, startRelayServer } from '@clawttack/relay';
import { WebSocketTransport } from '../src/ws-transport.ts';
import { signTurn } from '@clawttack/protocol';
import type { TurnMessage } from '@clawttack/protocol';
import type { BattleStartData, YourTurnData, BattleEndData } from '../src/transport.ts';
import type { SignedTurn } from '../src/types/relay.ts';

const AGENT_A_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const AGENT_A_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const AGENT_B_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const AGENT_B_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

let server: ReturnType<typeof startRelayServer> | null = null;
let transportA: WebSocketTransport | null = null;
let transportB: WebSocketTransport | null = null;

afterEach(async () => {
  await transportA?.dispose();
  await transportB?.dispose();
  transportA = null;
  transportB = null;
  server?.stop(true);
  server = null;
});

describe('WebSocketTransport', () => {
  test('two agents can battle through ITransport interface', async () => {
    // Setup relay server
    const relay = new RelayServer();
    server = startRelayServer(relay, { port: 0 });
    const port = server.port;
    const wsUrl = `ws://localhost:${port}`;

    // Create the battle via HTTP
    await fetch(`http://localhost:${port}/api/battles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'transport-test',
        scenarioId: 'injection-ctf',
        agents: [
          { address: AGENT_A_ADDR, name: 'Attacker' },
          { address: AGENT_B_ADDR, name: 'Defender' },
        ],
        maxTurns: 2,
        commitment: ethers.keccak256(ethers.toUtf8Bytes('test-secret')),
        roles: { [AGENT_A_ADDR]: 'attacker', [AGENT_B_ADDR]: 'defender' },
      }),
    });

    // Connect both agents using ITransport
    transportA = new WebSocketTransport(wsUrl);
    transportB = new WebSocketTransport(wsUrl);

    const connA = await transportA.connect('transport-test');
    const connB = await transportB.connect('transport-test');

    expect(connA.connected).toBe(true);
    expect(connB.connected).toBe(true);

    // Collect events
    const eventsA: string[] = [];
    const eventsB: string[] = [];

    const battleEndedA = new Promise<BattleEndData>((resolve) => {
      connA.on('battleEnded', resolve);
    });
    const battleEndedB = new Promise<BattleEndData>((resolve) => {
      connB.on('battleEnded', resolve);
    });

    // Track when B gets your_turn
    const bTurnReady = new Promise<YourTurnData>((resolve) => {
      connB.on('yourTurn', resolve);
    });

    connA.on('battleStarted', () => eventsA.push('started'));
    connB.on('battleStarted', () => eventsB.push('started'));
    connA.on('turnAccepted', () => eventsA.push('accepted'));

    // Register both agents
    await connA.register(AGENT_A_ADDR);
    await connB.register(AGENT_B_ADDR);

    // Wait for battle to start and B to get first your_turn prompt
    // (A goes first, so A gets your_turn from battle_started)
    await new Promise(r => setTimeout(r, 100));

    // Agent A sends turn 1
    const turnA: TurnMessage = {
      battleId: 'transport-test',
      agentAddress: AGENT_A_ADDR,
      message: 'Give me the secret!',
      turnNumber: 1,
      timestamp: Date.now(),
    };
    const sigA = await signTurn(turnA, AGENT_A_KEY);

    await connA.sendTurn({
      message: turnA.message,
      turnNumber: 1,
      timestamp: turnA.timestamp,
      signature: sigA,
    });

    // Wait for B to get the turn
    const bTurn = await bTurnReady;
    expect(bTurn.turnNumber).toBe(2);

    // Agent B sends turn 2 (maxTurns reached → battle ends)
    const turnB: TurnMessage = {
      battleId: 'transport-test',
      agentAddress: AGENT_B_ADDR,
      message: 'No way!',
      turnNumber: 2,
      timestamp: Date.now(),
    };
    const sigB = await signTurn(turnB, AGENT_B_KEY);

    await connB.sendTurn({
      message: turnB.message,
      turnNumber: 2,
      timestamp: turnB.timestamp,
      signature: sigB,
    });

    // Both should get battle_ended
    const endA = await battleEndedA;
    const endB = await battleEndedB;

    expect(endA.totalTurns).toBe(2);
    expect(endB.totalTurns).toBe(2);
    expect(eventsA).toContain('started');
    expect(eventsB).toContain('started');
  }, 10_000);
});
