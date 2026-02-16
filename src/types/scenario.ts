// src/types/scenario.ts — Pluggable scenario interface

export interface Agent {
  id: string;
  name: string;
  telegramUserId: number;
  wallet?: string; // ERC-8004 linked wallet (optional for MVP)
  agentId8004?: number; // ERC-8004 token ID (optional until linked)
  gatewayId?: string; // which gateway this agent connects through
}

export interface Turn {
  agentId: string;
  message: string;
  timestamp: number;
  turnNumber: number;
}

export type BattleState = 'pending' | 'setup' | 'active' | 'judging' | 'settled' | 'cancelled';

export type BattleRole = 'attacker' | 'defender';

export interface BattleOutcome {
  winnerId: string | null; // null = draw
  loserId: string | null;
  reason: string;
  verified: boolean; // cryptographically verified?
  metadata?: Record<string, unknown>;
}

export interface Battle {
  id: string;
  scenarioId: string;
  agents: Agent[];
  roles: Record<string, BattleRole>;
  telegramChatId: number;
  state: BattleState;
  turns: Turn[];
  maxTurns: number;
  currentTurn: number;
  activeAgentId: string | null; // whose turn is it?
  commitment?: string; // on-chain hash
  outcome?: BattleOutcome;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

/**
 * Scenario — the pluggable interface for battle types.
 * 
 * To add a new battle format:
 * 1. Create a file in src/scenarios/
 * 2. Implement this interface
 * 3. Register in src/scenarios/registry.ts
 */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly defaultMaxTurns: number;

  /**
   * Called when a battle is created. Returns initial scenario-specific state.
   * For Injection CTF: generates secret, returns hash commitment.
   */
  setup(battle: Battle): Promise<ScenarioSetup>;

  /**
   * Called when an agent sends a message during the battle.
   * Returns instructions for the orchestrator (advance turn, end battle, etc.)
   */
  onMessage(battle: Battle, agentId: string, message: string): Promise<TurnResult>;

  /**
   * Called when the battle needs final judging (e.g., max turns reached).
   * For Injection CTF: defender wins if secret wasn't extracted.
   */
  judge(battle: Battle): Promise<BattleOutcome>;

  /**
   * Generate system instructions for an agent based on their role.
   * Sent privately to the agent before the battle starts.
   */
  getRoleInstructions(battle: Battle, agentId: string): string;
}

export interface ScenarioSetup {
  commitment: string; // hash to verify outcome
  scenarioData: Record<string, unknown>; // scenario-specific state (stored encrypted/private)
  roleAssignments: Record<string, BattleRole>;
}

export interface TurnResult {
  action: 'continue' | 'end';
  nextAgentId?: string; // who goes next (if continue)
  outcome?: BattleOutcome; // if action is 'end'
  announcement?: string; // public message to the battle group
}
