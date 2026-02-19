import { describe, it, expect } from 'bun:test';
import { ArenaFighter, BattlePhase, ARENA_ABI, ArenaError } from '../src/arena-fighter.ts';

describe('ArenaFighter', () => {
  describe('generateSeed', () => {
    it('generates a 64-char hex string', () => {
      const seed = ArenaFighter.generateSeed();
      expect(seed).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(seed)).toBe(true);
    });

    it('generates unique seeds', () => {
      const seed1 = ArenaFighter.generateSeed();
      const seed2 = ArenaFighter.generateSeed();
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('commitSeed', () => {
    it('returns a bytes32 hex hash', () => {
      const seed = 'test-seed-123';
      const commit = ArenaFighter.commitSeed(seed);
      expect(commit).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      const seed = 'deterministic-seed';
      const commit1 = ArenaFighter.commitSeed(seed);
      const commit2 = ArenaFighter.commitSeed(seed);
      expect(commit1).toBe(commit2);
    });

    it('different seeds produce different commits', () => {
      const commit1 = ArenaFighter.commitSeed('seed-a');
      const commit2 = ArenaFighter.commitSeed('seed-b');
      expect(commit1).not.toBe(commit2);
    });
  });

  describe('BattlePhase enum', () => {
    it('has correct values', () => {
      expect(BattlePhase.Open).toBe(0);
      expect(BattlePhase.Committed).toBe(1);
      expect(BattlePhase.Active).toBe(2);
      expect(BattlePhase.Settled).toBe(3);
      expect(BattlePhase.Cancelled).toBe(4);
    });
  });

  describe('ARENA_ABI', () => {
    it('exports all expected functions', () => {
      const fnNames = ARENA_ABI
        .filter((x) => x.type === 'function')
        .map((x) => x.name);
      expect(fnNames).toContain('createChallenge');
      expect(fnNames).toContain('acceptChallenge');
      expect(fnNames).toContain('revealSeeds');
      expect(fnNames).toContain('submitTurn');
      expect(fnNames).toContain('claimTimeout');
      expect(fnNames).toContain('getChallengeWord');
      expect(fnNames).toContain('getBattleCore');
      expect(fnNames).toContain('getBattleTiming');
      expect(fnNames).toContain('whoseTurn');
      expect(fnNames).toContain('timeRemaining');
      expect(fnNames).toContain('agents');
    });

    it('exports all expected events', () => {
      const eventNames = ARENA_ABI
        .filter((x) => x.type === 'event')
        .map((x) => x.name);
      expect(eventNames).toContain('ChallengeCreated');
      expect(eventNames).toContain('ChallengeAccepted');
      expect(eventNames).toContain('SeedsRevealed');
      expect(eventNames).toContain('TurnSubmitted');
      expect(eventNames).toContain('BattleSettled');
    });
  });

  describe('ArenaError', () => {
    it('has correct name and reason', () => {
      const err = new ArenaError('NotYourTurn', 'Not your turn');
      expect(err.name).toBe('ArenaError');
      expect(err.reason).toBe('NotYourTurn');
      expect(err.message).toBe('Not your turn');
      expect(err instanceof Error).toBe(true);
    });

    it('preserves original error', () => {
      const original = new Error('raw viem error');
      const err = new ArenaError('InvalidPhase', 'Wrong phase', original);
      expect(err.originalError).toBe(original);
    });
  });
});
