// src/services/battle-manager.ts — Core battle orchestration

import { randomUUID } from 'crypto';
import type {
  Agent,
  Battle,
  BattleOutcome,
  TurnResult,
} from '../types/scenario.ts';
import type { ArenaDB } from '../db/index.ts';
import { getScenario } from '../scenarios/registry.ts';
import { calculateElo } from './elo.ts';

export interface BattleEvents {
  onBattleCreated(battle: Battle): void;
  onBattleStarted(battle: Battle, roleInstructions: Map<string, string>): void;
  onTurnProcessed(battle: Battle, result: TurnResult): void;
  onBattleEnded(battle: Battle, outcome: BattleOutcome): void;
}

export class BattleManager {
  constructor(
    private db: ArenaDB,
    private events: BattleEvents,
  ) {}

  /**
   * Create a new battle between agents.
   */
  async createBattle(
    scenarioId: string,
    agents: Agent[],
  ): Promise<Battle> {
    const scenario = getScenario(scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

    if (agents.length < scenario.minPlayers || agents.length > scenario.maxPlayers) {
      throw new Error(
        `Scenario ${scenarioId} requires ${scenario.minPlayers}-${scenario.maxPlayers} players, got ${agents.length}`
      );
    }

    // Check agents aren't already in a battle
    for (const agent of agents) {
      const existing = this.db.getActiveBattleForAgent(agent.id);
      if (existing) {
        throw new Error(`Agent ${agent.name} is already in battle ${existing.id}`);
      }
    }

    // Ensure agents exist in DB
    for (const agent of agents) {
      this.db.upsertAgent(agent);
    }

    const battleId = randomUUID();
    this.db.createBattle({
      id: battleId,
      scenarioId,
      maxTurns: scenario.defaultMaxTurns,
      agentIds: agents.map(a => a.id),
    });

    const battle = this.db.getBattle(battleId);
    if (!battle) throw new Error('Failed to create battle');

    this.events.onBattleCreated(battle);
    return battle;
  }

  /**
   * Start a battle — run scenario setup, assign roles, notify agents.
   */
  async startBattle(battleId: string, telegramChatId: number): Promise<Battle> {
    const battle = this.db.getBattle(battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);
    if (battle.state !== 'pending') throw new Error(`Battle ${battleId} is ${battle.state}, not pending`);

    const scenario = getScenario(battle.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${battle.scenarioId}`);

    // Run scenario setup
    const setup = await scenario.setup(battle);

    // Update battle with setup results
    this.db.updateBattleState(battleId, {
      state: 'active',
      telegramChatId,
      roles: setup.roleAssignments,
      commitment: setup.commitment,
      scenarioData: setup.scenarioData,
      startedAt: Math.floor(Date.now() / 1000),
      activeAgentId: this.getFirstAgent(battle, setup.roleAssignments),
      currentTurn: 1,
    });

    const updatedBattle = this.db.getBattle(battleId)!;

    // Generate role instructions for each agent
    const roleInstructions = new Map<string, string>();

    // We need to add scenarioData to the battle for getRoleInstructions
    const battleWithData = { ...updatedBattle, scenarioData: setup.scenarioData };

    for (const agent of battle.agents) {
      const instructions = scenario.getRoleInstructions(battleWithData, agent.id);
      roleInstructions.set(agent.id, instructions);
    }

    this.events.onBattleStarted(updatedBattle, roleInstructions);
    return updatedBattle;
  }

  /**
   * Process a message from an agent during a battle.
   */
  async processMessage(battleId: string, agentId: string, message: string): Promise<TurnResult> {
    const battle = this.db.getBattle(battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);
    if (battle.state !== 'active') throw new Error(`Battle ${battleId} is ${battle.state}, not active`);
    if (battle.activeAgentId !== agentId) {
      throw new Error(`Not ${agentId}'s turn. Active: ${battle.activeAgentId}`);
    }

    const scenario = getScenario(battle.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario: ${battle.scenarioId}`);

    // Record the turn
    this.db.addTurn(battleId, agentId, message, battle.currentTurn);

    // Get scenario data from DB for the scenario to check
    const rawBattle = this.db.getBattle(battleId)!;
    const scenarioDataRow = this.db.getScenarioData(battleId);
    const battleWithData = { ...rawBattle, scenarioData: scenarioDataRow };

    // Let the scenario process the message
    const result = await scenario.onMessage(battleWithData, agentId, message);

    if (result.action === 'end' && result.outcome) {
      await this.endBattle(battleId, result.outcome);
    } else if (result.action === 'continue') {
      this.db.updateBattleState(battleId, {
        activeAgentId: result.nextAgentId ?? null,
        currentTurn: battle.currentTurn + 1,
      });
    }

    const latestBattle = this.db.getBattle(battleId)!;
    this.events.onTurnProcessed(latestBattle, result);
    return result;
  }

  /**
   * End a battle and update records.
   */
  private async endBattle(battleId: string, outcome: BattleOutcome): Promise<void> {
    const battle = this.db.getBattle(battleId)!;

    this.db.updateBattleState(battleId, {
      state: 'settled',
      outcome,
      endedAt: Math.floor(Date.now() / 1000),
      activeAgentId: null,
    });

    // Update Elo ratings
    if (battle.agents.length === 2) {
      const [agent1, agent2] = battle.agents as [Agent, Agent];
      const agent1Row = this.db.getAgent(agent1.id);
      const agent2Row = this.db.getAgent(agent2.id);

      if (agent1Row && agent2Row) {
        const elo1 = this.db.getAgentElo(agent1.id);
        const elo2 = this.db.getAgentElo(agent2.id);

        let result: 'a_wins' | 'b_wins' | 'draw';
        if (outcome.winnerId === agent1.id) result = 'a_wins';
        else if (outcome.winnerId === agent2.id) result = 'b_wins';
        else result = 'draw';

        const [newElo1, newElo2] = calculateElo(elo1, elo2, result);

        if (outcome.winnerId === agent1.id) {
          this.db.updateAgentRecord(agent1.id, 'win', newElo1);
          this.db.updateAgentRecord(agent2.id, 'loss', newElo2);
        } else if (outcome.winnerId === agent2.id) {
          this.db.updateAgentRecord(agent1.id, 'loss', newElo1);
          this.db.updateAgentRecord(agent2.id, 'win', newElo2);
        } else {
          this.db.updateAgentRecord(agent1.id, 'draw', newElo1);
          this.db.updateAgentRecord(agent2.id, 'draw', newElo2);
        }
      }
    }

    const finalBattle = this.db.getBattle(battleId)!;
    this.events.onBattleEnded(finalBattle, outcome);
  }

  /**
   * Cancel a battle.
   */
  async cancelBattle(battleId: string, reason: string): Promise<void> {
    this.db.updateBattleState(battleId, {
      state: 'cancelled',
      endedAt: Math.floor(Date.now() / 1000),
      outcome: { winnerId: null, loserId: null, reason, verified: false },
    });
  }

  // --- Helpers ---

  private getFirstAgent(battle: Battle, roles: Record<string, string>): string {
    // Attacker goes first
    const attacker = Object.entries(roles).find(([, role]) => role === 'attacker');
    return attacker?.[0] ?? battle.agents[0]?.id ?? '';
  }
}
