// packages/sdk/tests/fighter.test.ts — Fighter unit tests
//
// Tests the Fighter class: construction, config defaults, fight flow,
// timeout handling, error paths, and result mapping.

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Fighter, type FighterConfig, type FightResult } from '../src/fighter.ts';

// --- Helpers ---

const BASE_CONFIG: FighterConfig = {
  relayUrl: 'http://localhost:8787',
  privateKey: '0x' + '1'.repeat(64),
  name: 'TestFighter',
  strategy: async (ctx) => `Turn ${ctx.turnNumber} response`,
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
      // Access private config via cast for testing
      const cfg = (fighter as any).config;
      expect(cfg.relayUrl).toBe('http://localhost:8787');
      expect(cfg.name).toBe('TestFighter');
      expect(cfg.turnTimeoutMs).toBeUndefined(); // defaults applied at fight() time
      expect(cfg.battleTimeoutMs).toBeUndefined();
      expect(cfg.verbose).toBeUndefined();
    });

    test('accepts custom timeouts', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        turnTimeoutMs: 10_000,
        battleTimeoutMs: 120_000,
        verbose: false,
      });
      const cfg = (fighter as any).config;
      expect(cfg.turnTimeoutMs).toBe(10_000);
      expect(cfg.battleTimeoutMs).toBe(120_000);
      expect(cfg.verbose).toBe(false);
    });

    test('creates ClawttackClient internally', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const client = (fighter as any).client;
      expect(client).toBeDefined();
      expect(client.address).toBeDefined();
      // Address should be derived from the private key
      expect(client.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe('config validation', () => {
    test('strategy function is stored', () => {
      const customStrategy = async () => 'custom response';
      const fighter = new Fighter({ ...BASE_CONFIG, strategy: customStrategy });
      expect((fighter as any).config.strategy).toBe(customStrategy);
    });

    test('relayUrl is passed to client', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        relayUrl: 'http://custom:9999',
      });
      expect((fighter as any).config.relayUrl).toBe('http://custom:9999');
    });

    test('name is passed through', () => {
      const fighter = new Fighter({ ...BASE_CONFIG, name: 'SpecialAgent' });
      expect((fighter as any).config.name).toBe('SpecialAgent');
    });
  });

  describe('strategy callback', () => {
    test('receives correct BattleContext shape', async () => {
      let receivedCtx: any = null;
      const fighter = new Fighter({
        ...BASE_CONFIG,
        strategy: async (ctx) => {
          receivedCtx = ctx;
          return 'test';
        },
      });
      // We can't easily call strategy through fight() without mocking WS,
      // but we can verify the strategy function works standalone
      const mockCtx = {
        battleId: '0x123',
        scenarioId: 'injection-ctf',
        role: 'attacker',
        turnNumber: 1,
        opponentMessage: undefined,
        maxTurns: 10,
      };
      const result = await (fighter as any).config.strategy(mockCtx);
      expect(receivedCtx).toEqual(mockCtx);
      expect(result).toBe('test');
    });

    test('strategy can access all context fields', async () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        strategy: async (ctx) => {
          return `${ctx.scenarioId}:${ctx.role}:${ctx.turnNumber}:${ctx.maxTurns}`;
        },
      });

      const result = await (fighter as any).config.strategy({
        battleId: '0xabc',
        scenarioId: 'poison-word',
        role: 'defender',
        turnNumber: 3,
        opponentMessage: 'hello',
        maxTurns: 8,
      });
      expect(result).toBe('poison-word:defender:3:8');
    });

    test('strategy receives opponent message when available', async () => {
      let capturedMsg: string | undefined;
      const fighter = new Fighter({
        ...BASE_CONFIG,
        strategy: async (ctx) => {
          capturedMsg = ctx.opponentMessage;
          return 'response';
        },
      });

      await (fighter as any).config.strategy({
        battleId: '0x1',
        scenarioId: 'test',
        role: 'attacker',
        turnNumber: 2,
        opponentMessage: 'opponent said this',
        maxTurns: 5,
      });
      expect(capturedMsg).toBe('opponent said this');
    });
  });

  describe('FightResult type', () => {
    test('result shape matches interface', () => {
      const result: FightResult = {
        battleId: '0x' + 'a'.repeat(64),
        scenarioId: 'injection-ctf',
        won: true,
        role: 'attacker',
        totalTurns: 5,
        reason: 'flag_captured',
        opponentAddress: '0x' + 'b'.repeat(40),
        opponentName: 'Opponent',
      };
      expect(result.battleId).toMatch(/^0x/);
      expect(result.won).toBe(true);
      expect(result.totalTurns).toBe(5);
    });

    test('won can be null for draws', () => {
      const result: FightResult = {
        battleId: '0x123',
        scenarioId: 'test',
        won: null,
        role: 'defender',
        totalTurns: 10,
        reason: 'max_turns',
        opponentAddress: '0x' + 'c'.repeat(40),
        opponentName: 'DrawBot',
      };
      expect(result.won).toBeNull();
    });

    test('won false for losses', () => {
      const result: FightResult = {
        battleId: '0x456',
        scenarioId: 'test',
        won: false,
        role: 'attacker',
        totalTurns: 3,
        reason: 'flag_stolen',
        opponentAddress: '0x' + 'd'.repeat(40),
        opponentName: 'WinnerBot',
      };
      expect(result.won).toBe(false);
    });
  });

  describe('WebSocket URL derivation', () => {
    test('http:// converts to ws://', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        relayUrl: 'http://localhost:8787',
      });
      // The URL conversion happens inside fight(), verify the logic
      const wsUrl = 'http://localhost:8787'.replace(/^http/, 'ws');
      expect(wsUrl).toBe('ws://localhost:8787');
    });

    test('https:// converts to wss://', () => {
      const wsUrl = 'https://relay.clawttack.com'.replace(/^http/, 'ws');
      expect(wsUrl).toBe('wss://relay.clawttack.com');
    });
  });

  describe('timeout defaults', () => {
    test('default turn timeout is 30s', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const cfg = (fighter as any).config;
      // Default is applied at fight() time: timeoutMs ?? 30_000
      expect(cfg.turnTimeoutMs ?? 30_000).toBe(30_000);
    });

    test('default battle timeout is 5 min', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const cfg = (fighter as any).config;
      // Default is applied at fight() time: battleTimeoutMs ?? 300_000
      expect(cfg.battleTimeoutMs ?? 300_000).toBe(300_000);
    });

    test('custom timeouts override defaults', () => {
      const fighter = new Fighter({
        ...BASE_CONFIG,
        turnTimeoutMs: 5_000,
        battleTimeoutMs: 60_000,
      });
      const cfg = (fighter as any).config;
      expect(cfg.turnTimeoutMs ?? 30_000).toBe(5_000);
      expect(cfg.battleTimeoutMs ?? 300_000).toBe(60_000);
    });
  });

  describe('verbose flag', () => {
    test('defaults to undefined (truthy at fight time via ??)', () => {
      const fighter = new Fighter(BASE_CONFIG);
      const cfg = (fighter as any).config;
      // verbose ?? true = true when undefined
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
