// tests/db.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ArenaDB } from '../src/db.ts';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = '/tmp/arena-test.db';

let db: ArenaDB;

beforeEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  db = new ArenaDB(TEST_DB);
});

afterEach(() => {
  db.close();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe('ArenaDB', () => {
  describe('Agents', () => {
    it('should upsert and retrieve an agent', () => {
      db.upsertAgent({ id: 'tg:123', name: 'TestBot', telegramUserId: 123 });
      const agent = db.getAgentByTelegramId(123);
      expect(agent).toBeTruthy();
      expect(agent!.name).toBe('TestBot');
      expect(agent!.id).toBe('tg:123');
    });

    it('should update name on re-upsert', () => {
      db.upsertAgent({ id: 'tg:123', name: 'OldName', telegramUserId: 123 });
      db.upsertAgent({ id: 'tg:123', name: 'NewName', telegramUserId: 123 });
      const agent = db.getAgentByTelegramId(123);
      expect(agent!.name).toBe('NewName');
    });

    it('should return null for unknown agent', () => {
      const agent = db.getAgentByTelegramId(999);
      expect(agent).toBeNull();
    });

    it('should return leaderboard', () => {
      db.upsertAgent({ id: 'tg:1', name: 'Bot1', telegramUserId: 1 });
      db.upsertAgent({ id: 'tg:2', name: 'Bot2', telegramUserId: 2 });
      const board = db.getLeaderboard();
      expect(board.length).toBe(2);
    });
  });

  describe('Battles', () => {
    it('should create and retrieve a battle', () => {
      db.upsertAgent({ id: 'tg:1', name: 'A', telegramUserId: 1 });
      db.upsertAgent({ id: 'tg:2', name: 'B', telegramUserId: 2 });

      db.createBattle({
        id: 'battle-1',
        scenarioId: 'injection-ctf',
        maxTurns: 20,
        agentIds: ['tg:1', 'tg:2'],
      });

      const battle = db.getBattle('battle-1');
      expect(battle).toBeTruthy();
      expect(battle!.agents.length).toBe(2);
      expect(battle!.state).toBe('pending');
    });

    it('should update battle state', () => {
      db.upsertAgent({ id: 'tg:1', name: 'A', telegramUserId: 1 });
      db.upsertAgent({ id: 'tg:2', name: 'B', telegramUserId: 2 });
      db.createBattle({ id: 'b-1', scenarioId: 'test', maxTurns: 10, agentIds: ['tg:1', 'tg:2'] });

      db.updateBattleState('b-1', {
        state: 'active',
        activeAgentId: 'tg:1',
        currentTurn: 1,
      });

      const battle = db.getBattle('b-1');
      expect(battle!.state).toBe('active');
      expect(battle!.activeAgentId).toBe('tg:1');
    });

    it('should find active battle for agent', () => {
      db.upsertAgent({ id: 'tg:1', name: 'A', telegramUserId: 1 });
      db.upsertAgent({ id: 'tg:2', name: 'B', telegramUserId: 2 });
      db.createBattle({ id: 'b-1', scenarioId: 'test', maxTurns: 10, agentIds: ['tg:1', 'tg:2'] });

      const battle = db.getActiveBattleForAgent('tg:1');
      expect(battle).toBeTruthy();
      expect(battle!.id).toBe('b-1');
    });
  });

  describe('Turns', () => {
    it('should add and retrieve turns', () => {
      db.upsertAgent({ id: 'tg:1', name: 'A', telegramUserId: 1 });
      db.upsertAgent({ id: 'tg:2', name: 'B', telegramUserId: 2 });
      db.createBattle({ id: 'b-1', scenarioId: 'test', maxTurns: 10, agentIds: ['tg:1', 'tg:2'] });

      db.addTurn('b-1', 'tg:1', 'Hello!', 1);
      db.addTurn('b-1', 'tg:2', 'Hi back!', 2);

      const battle = db.getBattle('b-1');
      expect(battle!.turns.length).toBe(2);
      expect(battle!.turns[0]!.message).toBe('Hello!');
    });
  });
});
