// packages/bot/tests/battle-manager.test.ts — Tests for in-memory battle manager

import { describe, it, expect, beforeEach } from 'bun:test';
import { BattleManager, type BattleEvents } from '../src/battle-manager.ts';
import type { Agent, Battle, BattleOutcome, TurnResult } from '../src/types.ts';

function noopEvents(): BattleEvents {
  return {
    onBattleCreated() {},
    onBattleStarted() {},
    onTurnProcessed() {},
    onBattleEnded() {},
  };
}

const AGENT_A: Agent = { id: 'tg:1', name: 'Alice', telegramUserId: 1 };
const AGENT_B: Agent = { id: 'tg:2', name: 'Bob', telegramUserId: 2 };

describe('BattleManager', () => {
  let mgr: BattleManager;

  beforeEach(() => {
    mgr = new BattleManager(noopEvents());
  });

  describe('Agents', () => {
    it('should register and retrieve an agent', () => {
      mgr.registerAgent(AGENT_A);
      const agent = mgr.getAgent('tg:1');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('Alice');
    });

    it('should find agent by telegram ID', () => {
      mgr.registerAgent(AGENT_A);
      const agent = mgr.getAgentByTelegramId(1);
      expect(agent).toBeDefined();
      expect(agent!.id).toBe('tg:1');
    });

    it('should return undefined for unknown agent', () => {
      expect(mgr.getAgent('tg:999')).toBeUndefined();
      expect(mgr.getAgentByTelegramId(999)).toBeUndefined();
    });

    it('should default elo to 1200', () => {
      mgr.registerAgent(AGENT_A);
      expect(mgr.getAgentElo('tg:1')).toBe(1200);
    });

    it('should return leaderboard sorted by elo', () => {
      mgr.registerAgent(AGENT_A);
      mgr.registerAgent(AGENT_B);
      const lb = mgr.getLeaderboard();
      expect(lb.length).toBe(2);
      expect(lb[0]!.elo).toBeGreaterThanOrEqual(lb[1]!.elo);
    });
  });

  describe('Battles', () => {
    it('should create a battle', async () => {
      const battle = await mgr.createBattle('injection-ctf', [AGENT_A, AGENT_B]);
      expect(battle.id).toBeDefined();
      expect(battle.state).toBe('pending');
      expect(battle.agents.length).toBe(2);
    });

    it('should auto-register agents on battle creation', async () => {
      await mgr.createBattle('injection-ctf', [AGENT_A, AGENT_B]);
      expect(mgr.getAgent('tg:1')).toBeDefined();
      expect(mgr.getAgent('tg:2')).toBeDefined();
    });

    it('should reject duplicate active battles for same agent', async () => {
      await mgr.createBattle('injection-ctf', [AGENT_A, AGENT_B]);
      await expect(
        mgr.createBattle('injection-ctf', [AGENT_A, { id: 'tg:3', name: 'Charlie', telegramUserId: 3 }]),
      ).rejects.toThrow('already in battle');
    });

    it('should start a battle and assign roles', async () => {
      const battle = await mgr.createBattle('injection-ctf', [AGENT_A, AGENT_B]);
      const started = await mgr.startBattle(battle.id, 12345);
      expect(started.state).toBe('active');
      expect(started.telegramChatId).toBe(12345);
      expect(Object.keys(started.roles).length).toBe(2);
      expect(started.commitment).toBeDefined();
      expect(started.activeAgentId).toBeDefined();
    });

    it('should find active battle for agent', async () => {
      const battle = await mgr.createBattle('injection-ctf', [AGENT_A, AGENT_B]);
      const found = mgr.getActiveBattleForAgent('tg:1');
      expect(found).toBeDefined();
      expect(found!.id).toBe(battle.id);
    });

    it('should cancel a battle', async () => {
      const battle = await mgr.createBattle('injection-ctf', [AGENT_A, AGENT_B]);
      await mgr.cancelBattle(battle.id, 'test');
      expect(mgr.getActiveBattleForAgent('tg:1')).toBeUndefined();
    });
  });
});
