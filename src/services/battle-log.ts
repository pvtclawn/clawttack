// src/services/battle-log.ts — Battle log export for IPFS + self-settlement
//
// Agents can request the full signed battle log at any time.
// They can independently verify all signatures, compute the outcome,
// and settle on-chain WITHOUT the relay's cooperation.

import { verifyTurn, computeTurnsMerkleRoot } from './crypto.ts';
import type { RelayBattle, BattleLog, TurnMessage } from '../types/relay.ts';

/** Export a battle to the canonical BattleLog format (for IPFS storage) */
export function exportBattleLog(battle: RelayBattle): BattleLog {
  if (battle.state !== 'ended' || !battle.outcome) {
    throw new Error('Cannot export log for unfinished battle');
  }

  return {
    version: 1,
    battleId: battle.id,
    scenarioId: battle.scenarioId,
    commitment: battle.commitment,
    agents: battle.agents.map((a) => ({
      address: a.address,
      name: a.name,
      role: battle.roles[a.address] ?? 'unknown',
    })),
    turns: battle.turns,
    outcome: battle.outcome,
    startedAt: battle.startedAt ?? battle.createdAt,
    endedAt: battle.endedAt ?? Date.now(),
  };
}

/** Verify an entire battle log — can be run by anyone with the log */
export function verifyBattleLog(log: BattleLog): VerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check version
  if (log.version !== 1) {
    errors.push(`Unknown log version: ${log.version}`);
    return { valid: false, errors, warnings, merkleRoot: null };
  }

  // 2. Verify every turn signature
  for (const turn of log.turns) {
    const turnMsg: TurnMessage = {
      battleId: log.battleId,
      agentAddress: turn.agentAddress,
      message: turn.message,
      turnNumber: turn.turnNumber,
      timestamp: turn.timestamp,
    };

    if (!verifyTurn(turnMsg, turn.signature)) {
      errors.push(`Turn ${turn.turnNumber}: invalid signature from ${turn.agentAddress}`);
    }
  }

  // 3. Verify turn ordering
  for (let i = 0; i < log.turns.length; i++) {
    const turn = log.turns[i]!;
    if (turn.turnNumber !== i + 1) {
      errors.push(`Turn ${i + 1}: expected turnNumber ${i + 1}, got ${turn.turnNumber}`);
    }
  }

  // 4. Verify agents participated
  const agentAddresses = new Set(log.agents.map((a) => a.address.toLowerCase()));
  for (const turn of log.turns) {
    if (!agentAddresses.has(turn.agentAddress.toLowerCase())) {
      errors.push(`Turn ${turn.turnNumber}: agent ${turn.agentAddress} not in agent list`);
    }
  }

  // 5. Verify timestamps are sequential
  for (let i = 1; i < log.turns.length; i++) {
    if (log.turns[i]!.timestamp < log.turns[i - 1]!.timestamp) {
      warnings.push(`Turn ${i + 1}: timestamp is earlier than previous turn`);
    }
  }

  // 6. Compute Merkle root for on-chain reference
  const turnMessages: TurnMessage[] = log.turns.map((t) => ({
    battleId: log.battleId,
    agentAddress: t.agentAddress,
    message: t.message,
    turnNumber: t.turnNumber,
    timestamp: t.timestamp,
  }));
  const merkleRoot = computeTurnsMerkleRoot(turnMessages);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    merkleRoot,
  };
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  merkleRoot: string | null;
}
