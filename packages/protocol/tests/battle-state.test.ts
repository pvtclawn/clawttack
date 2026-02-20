import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BattleStateManager, type BattleStateEntry, type BattleStateFile } from '../src/battle-state';

function tmpStatePath(): string {
  return join(tmpdir(), `clawttack-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function makeEntry(overrides?: Partial<BattleStateEntry>): BattleStateEntry {
  return {
    battleId: '0xabc123' as `0x${string}`,
    seed: 'deadbeef1234567890',
    commit: '0xcommit123' as `0x${string}`,
    role: 'challenger',
    agent: '0xAgent001' as `0x${string}`,
    arena: '0xArena001' as `0x${string}`,
    createdAt: '2026-02-20T12:00:00Z',
    phase: 'open',
    stakeWei: '0',
    ...overrides,
  };
}

describe('BattleStateManager', () => {
  let path: string;

  beforeEach(() => {
    path = tmpStatePath();
  });

  afterEach(() => {
    if (existsSync(path)) unlinkSync(path);
  });

  it('creates empty state when no file exists', () => {
    const mgr = new BattleStateManager(path);
    expect(mgr.getState()).toEqual({ version: 1, battles: {} });
    expect(existsSync(path)).toBe(false); // No write until saveBattle
  });

  it('saves and retrieves a battle entry', () => {
    const mgr = new BattleStateManager(path);
    const entry = makeEntry();

    mgr.saveBattle(entry);

    expect(existsSync(path)).toBe(true);
    expect(mgr.getBattle('0xabc123' as `0x${string}`)).toEqual(entry);
  });

  it('persists state across instances', () => {
    const mgr1 = new BattleStateManager(path);
    const entry = makeEntry({ seed: 'my-secret-seed-42' });
    mgr1.saveBattle(entry);

    // New instance reads from the same file
    const mgr2 = new BattleStateManager(path);
    const loaded = mgr2.getBattle('0xabc123' as `0x${string}`);
    expect(loaded).toBeDefined();
    expect(loaded!.seed).toBe('my-secret-seed-42');
    expect(loaded!.role).toBe('challenger');
  });

  it('updates battle phase', () => {
    const mgr = new BattleStateManager(path);
    mgr.saveBattle(makeEntry({ phase: 'open' }));

    mgr.updatePhase('0xabc123' as `0x${string}`, 'committed');
    expect(mgr.getBattle('0xabc123' as `0x${string}`)!.phase).toBe('committed');

    mgr.updatePhase('0xabc123' as `0x${string}`, 'active');
    expect(mgr.getBattle('0xabc123' as `0x${string}`)!.phase).toBe('active');

    // Persists across reload
    const mgr2 = new BattleStateManager(path);
    expect(mgr2.getBattle('0xabc123' as `0x${string}`)!.phase).toBe('active');
  });

  it('ignores updatePhase for unknown battleId', () => {
    const mgr = new BattleStateManager(path);
    mgr.saveBattle(makeEntry());

    // Should not throw
    mgr.updatePhase('0xunknown' as `0x${string}`, 'settled');
    expect(mgr.getBattle('0xabc123' as `0x${string}`)!.phase).toBe('open');
  });

  it('removes a battle entry', () => {
    const mgr = new BattleStateManager(path);
    mgr.saveBattle(makeEntry());

    mgr.removeBattle('0xabc123' as `0x${string}`);
    expect(mgr.getBattle('0xabc123' as `0x${string}`)).toBeUndefined();

    // Check file was updated
    const mgr2 = new BattleStateManager(path);
    expect(mgr2.getBattle('0xabc123' as `0x${string}`)).toBeUndefined();
  });

  it('lists battles with filters', () => {
    const mgr = new BattleStateManager(path);

    mgr.saveBattle(makeEntry({
      battleId: '0x001' as `0x${string}`,
      agent: '0xAlice' as `0x${string}`,
      phase: 'open',
    }));
    mgr.saveBattle(makeEntry({
      battleId: '0x002' as `0x${string}`,
      agent: '0xBob' as `0x${string}`,
      phase: 'active',
    }));
    mgr.saveBattle(makeEntry({
      battleId: '0x003' as `0x${string}`,
      agent: '0xAlice' as `0x${string}`,
      phase: 'settled',
    }));

    // All
    expect(mgr.listBattles()).toHaveLength(3);

    // By agent (case-insensitive)
    expect(mgr.listBattles({ agent: '0xalice' as `0x${string}` })).toHaveLength(2);
    expect(mgr.listBattles({ agent: '0xbob' as `0x${string}` })).toHaveLength(1);

    // By phase
    expect(mgr.listBattles({ phase: 'open' })).toHaveLength(1);
    expect(mgr.listBattles({ phase: 'active' })).toHaveLength(1);
    expect(mgr.listBattles({ phase: 'settled' })).toHaveLength(1);

    // Combined filter
    expect(mgr.listBattles({ agent: '0xAlice' as `0x${string}`, phase: 'open' })).toHaveLength(1);
  });

  it('finds resumable battles', () => {
    const mgr = new BattleStateManager(path);

    mgr.saveBattle(makeEntry({
      battleId: '0x001' as `0x${string}`,
      phase: 'open',
      agent: '0xMe' as `0x${string}`,
      arena: '0xArena' as `0x${string}`,
    }));
    mgr.saveBattle(makeEntry({
      battleId: '0x002' as `0x${string}`,
      phase: 'committed',
      agent: '0xMe' as `0x${string}`,
      arena: '0xArena' as `0x${string}`,
    }));
    mgr.saveBattle(makeEntry({
      battleId: '0x003' as `0x${string}`,
      phase: 'settled',
      agent: '0xMe' as `0x${string}`,
      arena: '0xArena' as `0x${string}`,
    }));
    mgr.saveBattle(makeEntry({
      battleId: '0x004' as `0x${string}`,
      phase: 'active',
      agent: '0xMe' as `0x${string}`,
      arena: '0xArena' as `0x${string}`,
    }));

    const resumable = mgr.findResumable('0xMe' as `0x${string}`, '0xArena' as `0x${string}`);
    expect(resumable).toHaveLength(3); // open, committed, active
    expect(resumable.map((e) => e.battleId).sort()).toEqual(['0x001', '0x002', '0x004']);
  });

  it('prunes completed battles', () => {
    const mgr = new BattleStateManager(path);

    mgr.saveBattle(makeEntry({ battleId: '0x001' as `0x${string}`, phase: 'active' }));
    mgr.saveBattle(makeEntry({ battleId: '0x002' as `0x${string}`, phase: 'settled' }));
    mgr.saveBattle(makeEntry({ battleId: '0x003' as `0x${string}`, phase: 'cancelled' }));
    mgr.saveBattle(makeEntry({ battleId: '0x004' as `0x${string}`, phase: 'open' }));

    const pruned = mgr.pruneCompleted();
    expect(pruned).toBe(2);
    expect(mgr.listBattles()).toHaveLength(2);
    expect(mgr.getBattle('0x002' as `0x${string}`)).toBeUndefined();
    expect(mgr.getBattle('0x003' as `0x${string}`)).toBeUndefined();
    expect(mgr.getBattle('0x001' as `0x${string}`)).toBeDefined();
    expect(mgr.getBattle('0x004' as `0x${string}`)).toBeDefined();
  });

  it('prunes returns 0 when nothing to prune', () => {
    const mgr = new BattleStateManager(path);
    mgr.saveBattle(makeEntry({ phase: 'active' }));
    expect(mgr.pruneCompleted()).toBe(0);
  });

  it('handles multiple saves to same battleId (overwrites)', () => {
    const mgr = new BattleStateManager(path);

    mgr.saveBattle(makeEntry({ seed: 'old-seed' }));
    mgr.saveBattle(makeEntry({ seed: 'new-seed' }));

    expect(mgr.getBattle('0xabc123' as `0x${string}`)!.seed).toBe('new-seed');
    expect(mgr.listBattles()).toHaveLength(1);
  });

  it('throws on corrupted state file', () => {
    // Write garbage
    const { writeFileSync } = require('node:fs');
    writeFileSync(path, 'not json at all', 'utf-8');

    expect(() => new BattleStateManager(path)).toThrow('Failed to load state file');
  });

  it('throws on wrong version', () => {
    const { writeFileSync } = require('node:fs');
    writeFileSync(path, JSON.stringify({ version: 99, battles: {} }), 'utf-8');

    expect(() => new BattleStateManager(path)).toThrow('Unsupported state file version');
  });

  it('writes valid JSON to disk', () => {
    const mgr = new BattleStateManager(path);
    mgr.saveBattle(makeEntry({ seed: 'super-secret', stakeWei: '1000000000000000' }));

    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as BattleStateFile;

    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.battles)).toHaveLength(1);
    expect(parsed.battles['0xabc123'].seed).toBe('super-secret');
    expect(parsed.battles['0xabc123'].stakeWei).toBe('1000000000000000');
  });

  it('getBattle returns undefined for missing ID', () => {
    const mgr = new BattleStateManager(path);
    expect(mgr.getBattle('0xnonexistent' as `0x${string}`)).toBeUndefined();
  });

  it('getFilePath returns the resolved path', () => {
    const mgr = new BattleStateManager(path);
    expect(mgr.getFilePath()).toBe(path);
  });
});
