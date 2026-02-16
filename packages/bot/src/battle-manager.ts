// packages/bot/src/battle-manager.ts — Core battle orchestration (in-memory)
//
// All state is ephemeral. Battles live in memory during the fight.
// Outcomes go on-chain (ClawttackRegistry) and IPFS (signed logs).
// If the bot restarts mid-battle, active battles are forfeit.

import { randomUUID } from 'crypto';
import type {
  Agent,
  Battle,
  BattleOutcome,
  BattleRole,
  BattleState,
  Turn,
  TurnResult,
} from './types.ts';
import { getScenario } from './scenarios/registry.ts';
import { calculateElo } from '@clawttack/protocol';

export interface BattleEvents {
  onBattleCreated(battle: Battle): void;
  onBattleStarted(battle: Battle, roleInstructions: Map<string, string>): void;
  onTurnProcessed(battle: Battle, result: TurnResult): void;
  onBattleEnded(battle: Battle, outcome: BattleOutcome): void;
}

/** In-memory agent store */
interface AgentRecord {
  agent: Agent;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export class BattleManager {
  private battles = new Map<string, Battle>();
  private scenarioData = new Map<string, Record<string, unknown>>();
  private agents = new Map<string, AgentRecord>();

  constructor(private events: BattleEvents) {}

  // --- Agent management ---

  registerAgent(agent: Agent): void {
    const existing = this.agents.get(agent.id);
    if (existing) {
      existing.agent = { ...existing.agent, ...agent };
    } else {
      this.agents.set(agent.id, {
        agent,
        elo: 1200,
        wins: 0,
        losses: 0,
        draws: 0,
      });
    }
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id)?.agent;
  }

  getAgentByTelegramId(telegramUserId: number): Agent | undefined {
    for (const record of this.agents.values()) {
      if (record.agent.telegramUserId === telegramUserId) {
        return record.agent;
      }
    }
    return undefined;
  }

  getAgentElo(id: string): number {
    return this.agents.get(id)?.elo ?? 1200;
  }

  getLeaderboard(limit = 20): Array<AgentRecord> {
    return [...this.agents.values()]
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  }

  // --- Battle lifecycle ---

  getActiveBattleForAgent(agentId: string): Battle | undefined {
    for (const battle of this.battles.values()) {
      if (
        battle.agents.some(a => a.id === agentId) &&
        (battle.state === 'pending' || battle.state === 'setup' || battle.state === 'active')
      ) {
        return battle;
      }
    }
    return undefined;
  }

  async createBattle(scenarioId: string, agents: Agent[]): Promise<Battle> {
    const scenario = getScenario(scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

    if (agents.length < scenario.minPlayers || agents.length > scenario.maxPlayers) {
      throw new Error(
        `Scenario ${scenarioId} requires ${scenario.minPlayers}-${scenario.maxPlayers} players, got ${agents.length}`,
      );
    }

    for (const agent of agents) {
      const existing = this.getActiveBattleForAgent(agent.id);
      if (existing) {
        throw new Error(`Agent ${agent.name} is already in battle ${existing.id}`);
      }
    }

    // Auto-register agents
    for (const agent of agents) {
      this.registerAgent(agent);
    }

    const battle: Battle = {
      id: randomUUID(),
      scenarioId,
      agents,
      roles: {},
      telegramChatId: 0,
      state: 'pending',
      turns: [],
      maxTurns: scenario.defaultMaxTurns,
      currentTurn: 0,
      activeAgentId: null,
      createdAt: Math.floor(Date.now() / 1000),
    };

    this.battles.set(battle.id, battle);
    this.events.onBattleCreated(battle);
    return battle;
  }

  async startBattle(battleId: string, telegramChatId: number): Promise<Battle> {
    const battle = this.battles.get(battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);
    if (battle.state !== 'pending') throw new Error(`Battle ${battleId} is ${battle.state}, not pending`);

    const scenario = getScenario(battle.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${battle.scenarioId}`);

    const setup = await scenario.setup(battle);

    // Update battle in place
    battle.state = 'active';
    battle.telegramChatId = telegramChatId;
    battle.roles = setup.roleAssignments;
    battle.commitment = setup.commitment;
    battle.startedAt = Math.floor(Date.now() / 1000);
    battle.currentTurn = 1;
    battle.activeAgentId = this.getFirstAgent(battle, setup.roleAssignments);

    // Store scenario data separately (contains secrets)
    this.scenarioData.set(battleId, setup.scenarioData);

    // Generate role instructions
    const roleInstructions = new Map<string, string>();
    const battleWithData = { ...battle, scenarioData: setup.scenarioData };

    for (const agent of battle.agents) {
      const instructions = scenario.getRoleInstructions(battleWithData, agent.id);
      roleInstructions.set(agent.id, instructions);
    }

    this.events.onBattleStarted(battle, roleInstructions);
    return battle;
  }

  async processMessage(battleId: string, agentId: string, message: string): Promise<TurnResult> {
    const battle = this.battles.get(battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);
    if (battle.state !== 'active') throw new Error(`Battle ${battleId} is ${battle.state}, not active`);
    if (battle.activeAgentId !== agentId) {
      throw new Error(`Not ${agentId}'s turn. Active: ${battle.activeAgentId}`);
    }

    const scenario = getScenario(battle.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${battle.scenarioId}`);

    // Record turn
    const turn: Turn = {
      agentId,
      message,
      turnNumber: battle.currentTurn,
      timestamp: Math.floor(Date.now() / 1000),
    };
    battle.turns.push(turn);

    // Build battle view with scenario data for the scenario to check
    const data = this.scenarioData.get(battleId) ?? {};
    const battleWithData = { ...battle, scenarioData: data };

    const result = await scenario.onMessage(battleWithData, agentId, message);

    if (result.action === 'end' && result.outcome) {
      this.endBattle(battleId, result.outcome);
    } else if (result.action === 'continue') {
      battle.activeAgentId = result.nextAgentId ?? null;
      battle.currentTurn += 1;
    }

    this.events.onTurnProcessed(battle, result);
    return result;
  }

  private endBattle(battleId: string, outcome: BattleOutcome): void {
    const battle = this.battles.get(battleId);
    if (!battle) return;

    battle.state = 'settled';
    battle.outcome = outcome;
    battle.endedAt = Math.floor(Date.now() / 1000);
    battle.activeAgentId = null;

    // Update in-memory Elo
    if (battle.agents.length === 2) {
      const [a1, a2] = battle.agents as [Agent, Agent];
      const r1 = this.agents.get(a1.id);
      const r2 = this.agents.get(a2.id);

      if (r1 && r2) {
        let result: 'a_wins' | 'b_wins' | 'draw';
        if (outcome.winnerId === a1.id) result = 'a_wins';
        else if (outcome.winnerId === a2.id) result = 'b_wins';
        else result = 'draw';

        const [newElo1, newElo2] = calculateElo(r1.elo, r2.elo, result);

        r1.elo = newElo1;
        r2.elo = newElo2;

        if (outcome.winnerId === a1.id) { r1.wins++; r2.losses++; }
        else if (outcome.winnerId === a2.id) { r1.losses++; r2.wins++; }
        else { r1.draws++; r2.draws++; }
      }
    }

    this.events.onBattleEnded(battle, outcome);

    // Clean up scenario data
    this.scenarioData.delete(battleId);
  }

  async cancelBattle(battleId: string, reason: string): Promise<void> {
    const battle = this.battles.get(battleId);
    if (!battle) return;

    battle.state = 'cancelled';
    battle.endedAt = Math.floor(Date.now() / 1000);
    battle.outcome = { winnerId: null, loserId: null, reason, verified: false };
    battle.activeAgentId = null;

    this.scenarioData.delete(battleId);
  }

  /** Clean up settled/cancelled battles older than maxAge */
  cleanup(maxAgeMs: number = 3600_000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, battle] of this.battles) {
      if (
        (battle.state === 'settled' || battle.state === 'cancelled') &&
        battle.endedAt &&
        now - battle.endedAt * 1000 > maxAgeMs
      ) {
        this.battles.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  private getFirstAgent(battle: Battle, roles: Record<string, string>): string {
    const attacker = Object.entries(roles).find(([, role]) => role === 'attacker');
    return attacker?.[0] ?? battle.agents[0]?.id ?? '';
  }
}
