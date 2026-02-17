import { describe, it, expect } from 'bun:test';
import { Matchmaker } from '../src/matchmaker.ts';
import { RelayServer } from '../src/server.ts';

describe('Matchmaker', () => {
  function createMatchmaker() {
    const relay = new RelayServer();
    const matches: any[] = [];
    const mm = new Matchmaker(relay, {
      maxTurns: 4,
      secrets: ['test secret one two'],
      onMatch: (m) => matches.push(m),
    });
    return { relay, mm, matches };
  }

  it('should queue a single agent without matching', () => {
    const { mm } = createMatchmaker();
    const result = mm.join('injection-ctf', '0xAAA', 'Agent1');
    expect(result.queued).toBe(true);
    expect(result.position).toBe(1);
    expect(result.match).toBeUndefined();
    mm.destroy();
  });

  it('should match when two agents join same scenario', () => {
    const { mm, matches } = createMatchmaker();
    mm.join('injection-ctf', '0xAAA', 'Agent1');
    const result = mm.join('injection-ctf', '0xBBB', 'Agent2');

    expect(result.queued).toBe(true);
    expect(result.match).toBeDefined();
    expect(result.match!.scenarioId).toBe('injection-ctf');
    expect(result.match!.agents).toHaveLength(2);
    expect(matches).toHaveLength(1);
    mm.destroy();
  });

  it('should not match agents in different scenarios', () => {
    const { mm } = createMatchmaker();
    mm.join('injection-ctf', '0xAAA', 'Agent1');
    const result = mm.join('prisoners-dilemma', '0xBBB', 'Agent2');

    expect(result.match).toBeUndefined();
    const status = mm.status();
    expect(status['injection-ctf']?.count).toBe(1);
    expect(status['prisoners-dilemma']?.count).toBe(1);
    mm.destroy();
  });

  it('should prevent duplicate queue entries', () => {
    const { mm } = createMatchmaker();
    mm.join('injection-ctf', '0xAAA', 'Agent1');
    const result = mm.join('injection-ctf', '0xAAA', 'Agent1');

    expect(result.queued).toBe(false);
    expect(result.position).toBe(1);
    mm.destroy();
  });

  it('should allow leaving the queue', () => {
    const { mm } = createMatchmaker();
    mm.join('injection-ctf', '0xAAA', 'Agent1');
    expect(mm.leave('0xAAA')).toBe(true);
    expect(mm.leave('0xAAA')).toBe(false); // Already left
    expect(mm.status()['injection-ctf']?.count ?? 0).toBe(0);
    mm.destroy();
  });

  it('should create battle on relay when matched', () => {
    const { relay, mm, matches } = createMatchmaker();
    mm.join('injection-ctf', '0xAAA', 'Agent1');
    mm.join('injection-ctf', '0xBBB', 'Agent2');

    expect(matches).toHaveLength(1);
    const battle = relay.getBattle(matches[0]!.battleId);
    expect(battle).toBeDefined();
    expect(battle!.agents).toHaveLength(2);
    expect(battle!.scenarioId).toBe('injection-ctf');
    expect(battle!.maxTurns).toBe(4);
    mm.destroy();
  });

  it('should assign roles for injection-ctf', () => {
    const { relay, mm, matches } = createMatchmaker();
    mm.join('injection-ctf', '0xAAA', 'Agent1');
    mm.join('injection-ctf', '0xBBB', 'Agent2');

    const battle = relay.getBattle(matches[0]!.battleId)!;
    const roles = Object.values(battle.roles);
    expect(roles).toContain('attacker');
    expect(roles).toContain('defender');
    mm.destroy();
  });
});
