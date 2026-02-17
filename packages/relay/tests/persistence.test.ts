import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BattlePersistence } from '../src/persistence.ts';
import * as fs from 'fs';
import * as path from 'path';
import type { RelayBattle } from '@clawttack/protocol';

const TEST_DIR = '/tmp/clawttack-test-persistence';

function makeBattle(id: string): RelayBattle {
  return {
    id,
    scenarioId: 'injection-ctf',
    agents: [
      { address: '0xaaa', name: 'Agent1', connected: false },
      { address: '0xbbb', name: 'Agent2', connected: false },
    ],
    turns: [],
    state: 'ended',
    maxTurns: 8,
    activeAgentIndex: 0,
    commitment: '0x123',
    scenarioData: {},
    roles: { '0xaaa': 'attacker', '0xbbb': 'defender' },
    createdAt: Date.now(),
  };
}

describe('BattlePersistence', () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should create data directory', () => {
    const p = new BattlePersistence({ dataDir: TEST_DIR });
    expect(fs.existsSync(TEST_DIR)).toBe(true);
  });

  it('should save and load a battle', () => {
    const p = new BattlePersistence({ dataDir: TEST_DIR });
    const battle = makeBattle('test-battle-1');
    p.save(battle);

    const loaded = p.load('test-battle-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('test-battle-1');
    expect(loaded!.scenarioId).toBe('injection-ctf');
    expect(loaded!.agents).toHaveLength(2);
  });

  it('should return null for missing battle', () => {
    const p = new BattlePersistence({ dataDir: TEST_DIR });
    expect(p.load('nonexistent')).toBeNull();
  });

  it('should list saved battles', () => {
    const p = new BattlePersistence({ dataDir: TEST_DIR });
    p.save(makeBattle('battle-a'));
    p.save(makeBattle('battle-b'));

    const list = p.list();
    expect(list).toHaveLength(2);
    expect(list).toContain('battle-a');
    expect(list).toContain('battle-b');
    expect(p.count).toBe(2);
  });

  it('should save to web public dir when configured', () => {
    const webDir = path.join(TEST_DIR, 'web');
    const p = new BattlePersistence({ dataDir: TEST_DIR, webPublicDir: webDir });
    p.save(makeBattle('web-battle'));

    expect(fs.existsSync(path.join(webDir, 'web-battle.json'))).toBe(true);
  });

  it('should include _meta in saved battles', () => {
    const p = new BattlePersistence({ dataDir: TEST_DIR });
    p.save(makeBattle('meta-battle'));

    const raw = JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'meta-battle.json'), 'utf-8'));
    expect(raw._meta).toBeDefined();
    expect(raw._meta.platform).toBe('clawttack');
    expect(raw._meta.signatures).toBe('ecdsa-secp256k1');
    expect(raw._meta.savedAt).toBeTruthy();
  });
});
