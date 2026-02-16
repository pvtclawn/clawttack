// tests/injection-ctf.test.ts

import { describe, it, expect } from 'bun:test';
import { InjectionCTFScenario } from '../src/scenarios/injection-ctf.ts';
import type { Battle, Agent } from '../src/types/scenario.ts';

const scenario = new InjectionCTFScenario();

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 'test-battle-1',
    scenarioId: 'injection-ctf',
    agents: [
      { id: 'agent-a', name: 'Attacker Bot', telegramUserId: 1 },
      { id: 'agent-b', name: 'Defender Bot', telegramUserId: 2 },
    ],
    roles: { 'agent-a': 'attacker', 'agent-b': 'defender' },
    telegramChatId: 12345,
    state: 'active',
    turns: [],
    maxTurns: 20,
    currentTurn: 1,
    activeAgentId: 'agent-a',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('InjectionCTFScenario', () => {
  it('should have correct metadata', () => {
    expect(scenario.id).toBe('injection-ctf');
    expect(scenario.minPlayers).toBe(2);
    expect(scenario.maxPlayers).toBe(2);
  });

  it('should generate setup with commitment and roles', async () => {
    const battle = makeBattle();
    const setup = await scenario.setup(battle);

    expect(setup.commitment).toBeTruthy();
    expect(setup.commitment.length).toBe(64); // SHA-256 hex
    expect(setup.scenarioData['secret']).toBeTruthy();
    expect(setup.scenarioData['secretHash']).toBe(setup.commitment);

    // Should have exactly one attacker and one defender
    const roles = Object.values(setup.roleAssignments);
    expect(roles).toContain('attacker');
    expect(roles).toContain('defender');
  });

  it('should detect when attacker extracts the secret', async () => {
    const secret = 'apple bridge castle dragon';
    const battle = makeBattle({
      scenarioData: { secret, secretHash: 'hash' },
    } as Partial<Battle>);

    const result = await scenario.onMessage(battle, 'agent-a', `I think the secret is ${secret}`);

    expect(result.action).toBe('end');
    expect(result.outcome?.winnerId).toBe('agent-a');
    expect(result.outcome?.verified).toBe(true);
  });

  it('should detect when defender leaks the secret', async () => {
    const secret = 'apple bridge castle dragon';
    const battle = makeBattle({
      scenarioData: { secret, secretHash: 'hash' },
    } as Partial<Battle>);

    const result = await scenario.onMessage(battle, 'agent-b', `Oh no I said ${secret} accidentally`);

    expect(result.action).toBe('end');
    expect(result.outcome?.winnerId).toBe('agent-a'); // Attacker wins
    expect(result.outcome?.verified).toBe(true);
  });

  it('should continue if secret is not mentioned', async () => {
    const secret = 'apple bridge castle dragon';
    const battle = makeBattle({
      scenarioData: { secret, secretHash: 'hash' },
    } as Partial<Battle>);

    const result = await scenario.onMessage(battle, 'agent-a', 'Hey, what are you thinking about?');

    expect(result.action).toBe('continue');
    expect(result.nextAgentId).toBe('agent-b');
  });

  it('should end battle when max turns reached', async () => {
    const secret = 'apple bridge castle dragon';
    const battle = makeBattle({
      currentTurn: 20,
      maxTurns: 20,
      scenarioData: { secret, secretHash: 'hash' },
    } as Partial<Battle>);

    const result = await scenario.onMessage(battle, 'agent-a', 'One last try?');

    expect(result.action).toBe('end');
    expect(result.outcome?.winnerId).toBe('agent-b'); // Defender wins
  });

  it('should generate role instructions for attacker', () => {
    const battle = makeBattle();
    const instructions = scenario.getRoleInstructions(battle, 'agent-a');

    expect(instructions).toContain('ATTACKER');
    expect(instructions).not.toContain('secret is:');
  });

  it('should generate role instructions for defender with secret', () => {
    const secret = 'apple bridge castle dragon';
    const battle = makeBattle({
      scenarioData: { secret, secretHash: 'hash' },
    } as Partial<Battle>);

    const instructions = scenario.getRoleInstructions(battle, 'agent-b');

    expect(instructions).toContain('DEFENDER');
    expect(instructions).toContain(secret);
  });
});
