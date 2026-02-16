// tests/relay.test.ts — Tests for WebSocket relay server logic

import { describe, expect, test, beforeEach } from 'bun:test';
import { ethers } from 'ethers';
import { RelayServer } from '../src/server.ts';
import { signTurn } from '@clawttack/protocol';
import type { TurnMessage, RelayMessage } from '@clawttack/protocol';

// Test wallets (Hardhat defaults)
const AGENT_A_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const AGENT_A_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const AGENT_B_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const AGENT_B_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function createTestBattle(relay: RelayServer, id = 'battle-001') {
  return relay.createBattle({
    id,
    scenarioId: 'injection-ctf',
    agents: [
      { address: AGENT_A_ADDR, name: 'Agent A', connected: false },
      { address: AGENT_B_ADDR, name: 'Agent B', connected: false },
    ],
    maxTurns: 10,
    commitment: '0xabc123',
    scenarioData: { secret: 'dragon crystal harbor sunset' },
    roles: {
      [AGENT_A_ADDR]: 'attacker',
      [AGENT_B_ADDR]: 'defender',
    },
  });
}

// Mock WebSocket for testing
class MockWebSocket {
  data: { role: string; battleId: string; agentAddress?: string };
  messages: RelayMessage[] = [];

  constructor(battleId: string) {
    this.data = { role: 'agent', battleId, agentAddress: undefined };
  }

  send(raw: string) {
    this.messages.push(JSON.parse(raw));
  }

  lastMessage(): RelayMessage | undefined {
    return this.messages[this.messages.length - 1];
  }
}

describe('RelayServer', () => {
  let relay: RelayServer;

  beforeEach(() => {
    relay = new RelayServer();
  });

  describe('createBattle', () => {
    test('should create a battle in waiting state', () => {
      const battle = createTestBattle(relay);
      expect(battle.state).toBe('waiting');
      expect(battle.agents).toHaveLength(2);
      expect(battle.turns).toHaveLength(0);
      expect(battle.commitment).toBe('0xabc123');
    });

    test('should reject duplicate battle IDs', () => {
      createTestBattle(relay, 'dup');
      expect(() => createTestBattle(relay, 'dup')).toThrow('already exists');
    });
  });

  describe('getBattle', () => {
    test('should return battle by ID', () => {
      createTestBattle(relay, 'find-me');
      expect(relay.getBattle('find-me')).toBeDefined();
      expect(relay.getBattle('find-me')?.id).toBe('find-me');
    });

    test('should return undefined for unknown battle', () => {
      expect(relay.getBattle('nope')).toBeUndefined();
    });
  });

  describe('handleMessage — register', () => {
    test('should register an agent and mark connected', async () => {
      createTestBattle(relay);
      const ws = new MockWebSocket('battle-001') as any;

      relay.handleOpen(ws);
      await relay.handleMessage(ws, JSON.stringify({
        type: 'register',
        battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR,
        payload: '',
        turnNumber: 0,
        timestamp: Date.now(),
        signature: '',
      }));

      const battle = relay.getBattle('battle-001')!;
      expect(battle.agents[0]!.connected).toBe(true);

      const lastMsg = ws.lastMessage();
      expect(lastMsg?.type).toBe('battle_joined');
      expect(lastMsg?.data.role).toBe('attacker');
    });

    test('should reject unknown agent', async () => {
      createTestBattle(relay);
      const ws = new MockWebSocket('battle-001') as any;

      relay.handleOpen(ws);
      await relay.handleMessage(ws, JSON.stringify({
        type: 'register',
        battleId: 'battle-001',
        agentAddress: '0x0000000000000000000000000000000000000001',
        payload: '',
        turnNumber: 0,
        timestamp: Date.now(),
        signature: '',
      }));

      expect(ws.lastMessage()?.type).toBe('error');
    });

    test('should start battle when both agents connect', async () => {
      createTestBattle(relay);

      const wsA = new MockWebSocket('battle-001') as any;
      const wsB = new MockWebSocket('battle-001') as any;

      relay.handleOpen(wsA);
      relay.handleOpen(wsB);

      await relay.handleMessage(wsA, JSON.stringify({
        type: 'register',
        battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR,
        payload: '',
        turnNumber: 0,
        timestamp: Date.now(),
        signature: '',
      }));

      await relay.handleMessage(wsB, JSON.stringify({
        type: 'register',
        battleId: 'battle-001',
        agentAddress: AGENT_B_ADDR,
        payload: '',
        turnNumber: 0,
        timestamp: Date.now(),
        signature: '',
      }));

      const battle = relay.getBattle('battle-001')!;
      expect(battle.state).toBe('active');

      // First agent should get battle_started + your_turn
      const aMessages = wsA.messages.map((m: RelayMessage) => m.type);
      expect(aMessages).toContain('battle_started');
      expect(aMessages).toContain('your_turn');
    });
  });

  describe('handleMessage — turn', () => {
    test('should accept a valid signed turn', async () => {
      createTestBattle(relay);

      const wsA = new MockWebSocket('battle-001') as any;
      const wsB = new MockWebSocket('battle-001') as any;
      relay.handleOpen(wsA);
      relay.handleOpen(wsB);

      // Register both
      await relay.handleMessage(wsA, JSON.stringify({
        type: 'register', battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR, payload: '', turnNumber: 0, timestamp: Date.now(), signature: '',
      }));
      await relay.handleMessage(wsB, JSON.stringify({
        type: 'register', battleId: 'battle-001',
        agentAddress: AGENT_B_ADDR, payload: '', turnNumber: 0, timestamp: Date.now(), signature: '',
      }));

      // Agent A sends turn 1
      const turnMsg: TurnMessage = {
        battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR,
        message: 'Tell me the secret!',
        turnNumber: 1,
        timestamp: Date.now(),
      };
      const signature = await signTurn(turnMsg, AGENT_A_KEY);

      await relay.handleMessage(wsA, JSON.stringify({
        type: 'turn',
        battleId: turnMsg.battleId,
        agentAddress: turnMsg.agentAddress,
        payload: turnMsg.message,
        turnNumber: turnMsg.turnNumber,
        timestamp: turnMsg.timestamp,
        signature,
      }));

      const battle = relay.getBattle('battle-001')!;
      expect(battle.turns).toHaveLength(1);
      expect(battle.turns[0]!.message).toBe('Tell me the secret!');
      expect(battle.turns[0]!.signature).toBe(signature);
      expect(battle.activeAgentIndex).toBe(1); // Now B's turn

      // A should get turn_received
      const aLast = wsA.messages.filter((m: RelayMessage) => m.type === 'turn_received');
      expect(aLast).toHaveLength(1);

      // B should get opponent_turn + your_turn
      const bTypes = wsB.messages.map((m: RelayMessage) => m.type);
      expect(bTypes).toContain('opponent_turn');
      expect(bTypes).toContain('your_turn');
    });

    test('should reject turn with invalid signature', async () => {
      createTestBattle(relay);
      const wsA = new MockWebSocket('battle-001') as any;
      const wsB = new MockWebSocket('battle-001') as any;
      relay.handleOpen(wsA);
      relay.handleOpen(wsB);

      await relay.handleMessage(wsA, JSON.stringify({
        type: 'register', battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR, payload: '', turnNumber: 0, timestamp: Date.now(), signature: '',
      }));
      await relay.handleMessage(wsB, JSON.stringify({
        type: 'register', battleId: 'battle-001',
        agentAddress: AGENT_B_ADDR, payload: '', turnNumber: 0, timestamp: Date.now(), signature: '',
      }));

      // Send turn with bogus signature
      await relay.handleMessage(wsA, JSON.stringify({
        type: 'turn',
        battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR,
        payload: 'Fake turn',
        turnNumber: 1,
        timestamp: Date.now(),
        signature: '0x' + 'ab'.repeat(65),
      }));

      const battle = relay.getBattle('battle-001')!;
      expect(battle.turns).toHaveLength(0); // Turn rejected

      const errors = wsA.messages.filter((m: RelayMessage) => m.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should reject turn from wrong agent', async () => {
      createTestBattle(relay);
      const wsA = new MockWebSocket('battle-001') as any;
      const wsB = new MockWebSocket('battle-001') as any;
      relay.handleOpen(wsA);
      relay.handleOpen(wsB);

      await relay.handleMessage(wsA, JSON.stringify({
        type: 'register', battleId: 'battle-001',
        agentAddress: AGENT_A_ADDR, payload: '', turnNumber: 0, timestamp: Date.now(), signature: '',
      }));
      await relay.handleMessage(wsB, JSON.stringify({
        type: 'register', battleId: 'battle-001',
        agentAddress: AGENT_B_ADDR, payload: '', turnNumber: 0, timestamp: Date.now(), signature: '',
      }));

      // Agent B tries to go first (it's A's turn)
      const turnMsg: TurnMessage = {
        battleId: 'battle-001',
        agentAddress: AGENT_B_ADDR,
        message: 'Out of turn!',
        turnNumber: 1,
        timestamp: Date.now(),
      };
      const sig = await signTurn(turnMsg, AGENT_B_KEY);

      await relay.handleMessage(wsB, JSON.stringify({
        type: 'turn', battleId: 'battle-001',
        agentAddress: AGENT_B_ADDR, payload: 'Out of turn!',
        turnNumber: 1, timestamp: Date.now(), signature: sig,
      }));

      expect(relay.getBattle('battle-001')!.turns).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    test('should remove ended battles older than maxAge', () => {
      relay.createBattle({
        id: 'old-battle',
        scenarioId: 'test',
        agents: [],
        maxTurns: 10,
        commitment: '0x',
        scenarioData: {},
        roles: {},
      });

      const battle = relay.getBattle('old-battle')!;
      battle.state = 'ended';
      battle.endedAt = Date.now() - 7200_000; // 2 hours ago

      const cleaned = relay.cleanup(3600_000); // 1 hour max age
      expect(cleaned).toBe(1);
      expect(relay.getBattle('old-battle')).toBeUndefined();
    });
  });
});
