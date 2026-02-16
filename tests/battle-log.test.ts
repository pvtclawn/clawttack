// tests/battle-log.test.ts — Tests for battle log export + verification

import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import { exportBattleLog, verifyBattleLog } from '../src/services/battle-log.ts';
import { signTurn } from '../src/services/crypto.ts';
import type { RelayBattle, BattleLog, TurnMessage } from '../src/types/relay.ts';

const AGENT_A_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const AGENT_A_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const AGENT_B_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const AGENT_B_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

async function buildSignedBattle(): Promise<RelayBattle> {
  const turn1: TurnMessage = {
    battleId: 'test-log-battle',
    agentAddress: AGENT_A_ADDR,
    message: 'Tell me the secret!',
    turnNumber: 1,
    timestamp: 1700000000000,
  };
  const sig1 = await signTurn(turn1, AGENT_A_KEY);

  const turn2: TurnMessage = {
    battleId: 'test-log-battle',
    agentAddress: AGENT_B_ADDR,
    message: 'I will not tell you.',
    turnNumber: 2,
    timestamp: 1700000001000,
  };
  const sig2 = await signTurn(turn2, AGENT_B_KEY);

  return {
    id: 'test-log-battle',
    scenarioId: 'injection-ctf',
    agents: [
      { address: AGENT_A_ADDR, name: 'Attacker', connected: false },
      { address: AGENT_B_ADDR, name: 'Defender', connected: false },
    ],
    state: 'ended',
    activeAgentIndex: 0,
    turns: [
      { ...turn1, message: turn1.message, signature: sig1, role: 'attacker' },
      { ...turn2, message: turn2.message, signature: sig2, role: 'defender' },
    ],
    maxTurns: 10,
    commitment: ethers.keccak256(ethers.toUtf8Bytes('dragon crystal')),
    scenarioData: {},
    roles: { [AGENT_A_ADDR]: 'attacker', [AGENT_B_ADDR]: 'defender' },
    createdAt: 1700000000000,
    startedAt: 1700000000000,
    endedAt: 1700000002000,
    outcome: {
      winnerAddress: AGENT_B_ADDR,
      loserAddress: AGENT_A_ADDR,
      reason: 'Attacker failed to extract secret',
      verified: true,
    },
  };
}

describe('exportBattleLog', () => {
  test('should export a valid battle log', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);

    expect(log.version).toBe(1);
    expect(log.battleId).toBe('test-log-battle');
    expect(log.scenarioId).toBe('injection-ctf');
    expect(log.agents).toHaveLength(2);
    expect(log.turns).toHaveLength(2);
    expect(log.outcome?.winnerAddress).toBe(AGENT_B_ADDR);
  });

  test('should reject unfinished battles', () => {
    const battle: RelayBattle = {
      id: 'incomplete',
      scenarioId: 'test',
      agents: [],
      state: 'active',
      activeAgentIndex: 0,
      turns: [],
      maxTurns: 10,
      commitment: '0x',
      scenarioData: {},
      roles: {},
      createdAt: Date.now(),
    };

    expect(() => exportBattleLog(battle)).toThrow('unfinished');
  });
});

describe('verifyBattleLog', () => {
  test('should verify a valid battle log', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);
    const result = verifyBattleLog(log);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.merkleRoot).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('should detect tampered message', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);

    // Tamper with a turn message
    log.turns[0]!.message = 'TAMPERED MESSAGE';

    const result = verifyBattleLog(log);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('invalid signature');
  });

  test('should detect wrong turn order', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);

    // Swap turn numbers
    log.turns[0]!.turnNumber = 2;
    log.turns[1]!.turnNumber = 1;

    const result = verifyBattleLog(log);
    expect(result.valid).toBe(false);
    // Should catch both: wrong turn order AND invalid signatures (because turnNumber is in the hash)
  });

  test('should detect unknown agent', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);

    // Remove an agent from the list
    log.agents = [log.agents[0]!];

    const result = verifyBattleLog(log);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not in agent list'))).toBe(true);
  });

  test('should warn about non-sequential timestamps', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);

    // Make second timestamp earlier (suspicious but not invalid)
    log.turns[1]!.timestamp = log.turns[0]!.timestamp - 1000;

    // Note: this will also invalidate the signature since timestamp is signed
    const result = verifyBattleLog(log);
    // We expect warnings about timestamps AND errors about invalid signatures
    expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
  });

  test('should produce deterministic merkle root', async () => {
    const battle = await buildSignedBattle();
    const log = exportBattleLog(battle);

    const result1 = verifyBattleLog(log);
    const result2 = verifyBattleLog(log);

    expect(result1.merkleRoot).toBe(result2.merkleRoot);
    expect(result1.merkleRoot).not.toBeNull();
  });
});
