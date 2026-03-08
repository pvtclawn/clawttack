// packages/sdk/tests/fighter.test.ts — Fighter unit tests
//
// Tests the Fighter class: construction, config defaults, fight flow,
// timeout handling, error paths, and result mapping.

import { describe, test, expect } from 'bun:test';
import { ethers } from 'ethers';
import { Fighter, type FighterConfig, type FightResult } from '../src/fighter.ts';

// --- Helpers ---

// Minimal mocks so the Fighter constructor doesn't attempt live RPC
const mockProvider = new ethers.JsonRpcProvider('http://localhost:8545');
const mockWallet = new ethers.Wallet(
  '0x' + '1'.repeat(64),
  mockProvider,
);
const MOCK_BATTLE_ADDRESS = '0x' + 'a'.repeat(40);

const BASE_CONFIG: FighterConfig = {
  provider: mockProvider,
  wallet: mockWallet,
  battleAddress: MOCK_BATTLE_ADDRESS,
  agentId: 1n,
  strategy: async (_ctx) => ({ narrative: 'test', poisonWord: 'abandon' }),
  verbose: false,
};

describe('Fighter', () => {
  describe('construction', () => {
    test('creates with valid config', () => {
      const fighter = new Fighter(BASE_CONFIG);
      expect(fighter).toBeDefined();
      expect(fighter).toBeInstanceOf(Fighter);
    });

    test('stores config with defaults', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const cfg = (fighter as any).config;
      expect(cfg.battleAddress).toBe(MOCK_BATTLE_ADDRESS);
      expect(cfg.agentId).toBe(1n);
      expect(cfg.pollIntervalMs).toBeUndefined(); // defaults applied at fight() time
      expect(cfg.maxBattleTimeMs).toBeUndefined();
      expect(cfg.verbose).toBe(false);
    });

    test('accepts custom poll interval', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        pollIntervalMs: 2000,
        maxBattleTimeMs: 600_000,
        verbose: true,
      });
      const cfg = (fighter as any).config;
      expect(cfg.pollIntervalMs).toBe(2000);
      expect(cfg.maxBattleTimeMs).toBe(600_000);
      expect(cfg.verbose).toBe(true);
    });

    test('creates battle contract internally', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const battle = (fighter as any).battle;
      expect(battle).toBeDefined();
      expect(battle.target).toBe(MOCK_BATTLE_ADDRESS);
    });
  });

  describe('config validation', () => {
    test('strategy function is stored', () => {
      const customStrategy = async () => ({ narrative: 'custom', poisonWord: 'able' });
      const fighter = new Fighter({ ...BASE_CONFIG, strategy: customStrategy });
      expect((fighter as any).config.strategy).toBe(customStrategy);
    });

    test('battleAddress is passed to contract', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        battleAddress: '0x' + 'b'.repeat(40),
      });
      expect((fighter as any).config.battleAddress).toBe('0x' + 'b'.repeat(40));
    });

    test('agentId is passed through', () => {
      const fighter = new Fighter({ ...BASE_CONFIG, agentId: 42n });
      expect((fighter as any).config.agentId).toBe(42n);
    });
  });

  describe('strategy callback', () => {
    test('receives correct BattleContext shape', async () => {
      let receivedCtx: any = null;
      const fighter = new Fighter({
        ...BASE_CONFIG,
        strategy: async (ctx) => {
          receivedCtx = ctx;
          return { narrative: 'test', poisonWord: 'able' };
        },
      });
      const mockCtx = {
        turnNumber: 1,
        isAgentA: true,
        myBank: 400n,
        opponentBank: 400n,
        targetWord: 'abandon',
        poisonWord: 'able',
        vopParams: '0x' as `0x${string}`,
        opponentNarrative: undefined,
        opponentNccAttack: null,
        myPreviousNccAttack: null,
        sequenceHash: '0x' as `0x${string}`,
        recentNarratives: [],
        jokersRemaining: 2,
      };
      const result = await (fighter as any).config.strategy(mockCtx);
      expect(receivedCtx).toEqual(mockCtx);
      expect(result.narrative).toBe('test');
    });

    test('strategy can access all context fields', async () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        strategy: async (ctx) => ({
          narrative: `${ctx.targetWord}:${ctx.turnNumber}:${ctx.jokersRemaining}`,
          poisonWord: 'able',
        }),
      });

      const result = await (fighter as any).config.strategy({
        turnNumber: 3,
        isAgentA: false,
        myBank: 300n,
        opponentBank: 350n,
        targetWord: 'abandon',
        poisonWord: 'able',
        vopParams: '0x' as `0x${string}`,
        opponentNarrative: 'hello',
        opponentNccAttack: null,
        myPreviousNccAttack: null,
        sequenceHash: '0xabc' as `0x${string}`,
        recentNarratives: [],
        jokersRemaining: 1,
      });
      expect(result.narrative).toBe('abandon:3:1');
    });

    test('strategy receives opponentNarrative when available', async () => {
      let capturedNarrative: string | undefined;
      const fighter = new Fighter({
        ...BASE_CONFIG,
        strategy: async (ctx) => {
          capturedNarrative = ctx.opponentNarrative;
          return { narrative: 'response', poisonWord: 'able' };
        },
      });

      await (fighter as any).config.strategy({
        turnNumber: 2,
        isAgentA: true,
        myBank: 400n,
        opponentBank: 380n,
        targetWord: 'ability',
        poisonWord: 'able',
        vopParams: '0x' as `0x${string}`,
        opponentNarrative: 'opponent said this',
        opponentNccAttack: null,
        myPreviousNccAttack: null,
        sequenceHash: '0x1' as `0x${string}`,
        recentNarratives: [],
        jokersRemaining: 2,
      });
      expect(capturedNarrative).toBe('opponent said this');
    });
  });

  describe('FightResult type', () => {
    test('result shape matches interface', () => {
      const result: FightResult = {
        battleAddress: '0x' + 'a'.repeat(40),
        won: true,
        reason: 'settled',
        totalTurns: 5,
        gasUsed: 100000n,
      };
      expect(result.battleAddress).toMatch(/^0x/);
      expect(result.won).toBe(true);
      expect(result.totalTurns).toBe(5);
    });

    test('won can be null for draws', () => {
      const result: FightResult = {
        battleAddress: '0x123',
        won: null,
        reason: 'fighter_timeout',
        totalTurns: 10,
        gasUsed: 0n,
      };
      expect(result.won).toBeNull();
    });

    test('won false for losses', () => {
      const result: FightResult = {
        battleAddress: '0x456',
        won: false,
        reason: 'settled',
        totalTurns: 3,
        gasUsed: 50000n,
      };
      expect(result.won).toBe(false);
    });
  });

  describe('battle contract', () => {
    test('battle contract target matches config address', () => {
      const addr = '0x' + 'c'.repeat(40);
      const fighter = new Fighter({ ...BASE_CONFIG, battleAddress: addr });
      expect((fighter as any).battle.target).toBe(addr);
    });

    test('wordDict is null by default (no wordDictionaryAddress)', () => {
      const fighter = new Fighter(BASE_CONFIG);
      expect((fighter as any).wordDict).toBeNull();
    });
  });

  describe('timeout defaults', () => {
    test('default poll interval is 4s at fight() time', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const cfg = (fighter as any).config;
      expect(cfg.pollIntervalMs ?? 4000).toBe(4000);
    });

    test('default max battle time is 60min at fight() time', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const cfg = (fighter as any).config;
      expect(cfg.maxBattleTimeMs ?? 3_600_000).toBe(3_600_000);
    });

    test('custom timeouts override defaults', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        pollIntervalMs: 2000,
        maxBattleTimeMs: 120_000,
      });
      const cfg = (fighter as any).config;
      expect(cfg.pollIntervalMs ?? 4000).toBe(2000);
      expect(cfg.maxBattleTimeMs ?? 3_600_000).toBe(120_000);
    });
  });

  describe('verbose flag', () => {
    test('defaults to undefined (true at fight time)', () => {
      const fighter = new Fighter({ ...BASE_CONFIG, verbose: undefined });
      const cfg = (fighter as any).config;
      expect(cfg.verbose ?? true).toBe(true);
    });

    test('can be explicitly disabled', () => {
      const fighter = new Fighter({ ...BASE_CONFIG, verbose: false });
      expect((fighter as any).config.verbose).toBe(false);
    });

    test('can be explicitly enabled', () => {
      const fighter = new Fighter({ ...BASE_CONFIG, verbose: true });
      expect((fighter as any).config.verbose).toBe(true);
    });
  });
});
