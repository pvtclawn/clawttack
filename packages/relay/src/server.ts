// src/relay/server.ts — WebSocket relay server for Clawttack battles
//
// The relay is UNTRUSTED infrastructure. It forwards signed messages
// between agents and broadcasts to spectators. It cannot tamper with
// turns because each turn is ECDSA-signed by the agent's wallet.

import type { ServerWebSocket } from 'bun';
import { verifyTurn } from '@clawttack/protocol';
import type {
  AgentMessage,
  RelayMessage,
  RelayBattle,
  RelayAgent,
  SignedTurn,
  BattleOutcome,
  TurnMessage,
} from '@clawttack/protocol';

/** Connection types */
type ConnectionRole = 'agent' | 'spectator';

interface ConnectionState {
  role: ConnectionRole;
  battleId: string;
  agentAddress?: string; // Only for agent connections
}

/** Default turn timeout: 60 seconds */
const DEFAULT_TURN_TIMEOUT_MS = 60_000;

/** Relay server state */
export class RelayServer {
  private battles = new Map<string, RelayBattle>();
  private connections = new Map<ServerWebSocket<ConnectionState>, ConnectionState>();
  private onBattleEnd?: (battle: RelayBattle) => Promise<void>;
  private turnTimers = new Map<string, Timer>(); // battleId → timeout handle
  private turnTimeoutMs: number;

  constructor(opts?: {
    onBattleEnd?: (battle: RelayBattle) => Promise<void>;
    turnTimeoutMs?: number;
  }) {
    this.onBattleEnd = opts?.onBattleEnd;
    this.turnTimeoutMs = opts?.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS;
  }

  /** Start a turn timer — auto-forfeit if active agent doesn't respond */
  private startTurnTimer(battle: RelayBattle): void {
    this.clearTurnTimer(battle.id);
    if (battle.state !== 'active' || this.turnTimeoutMs <= 0) return;

    const activeAgent = battle.agents[battle.activeAgentIndex];
    if (!activeAgent) return;

    const timer = setTimeout(async () => {
      // Double-check battle is still active and same agent's turn
      const current = this.battles.get(battle.id);
      if (!current || current.state !== 'active') return;
      if (current.agents[current.activeAgentIndex]?.address !== activeAgent.address) return;

      // Auto-forfeit the stalling agent
      const opponentIndex = current.agents.findIndex(
        a => a.address.toLowerCase() !== activeAgent.address.toLowerCase(),
      );
      const winner = current.agents[opponentIndex];

      await this.endBattle(current, {
        winnerAddress: winner?.address ?? null,
        loserAddress: activeAgent.address,
        reason: `${activeAgent.name ?? activeAgent.address} timed out (${this.turnTimeoutMs / 1000}s)`,
        verified: false,
      });
    }, this.turnTimeoutMs);

    this.turnTimers.set(battle.id, timer);
  }

  /** Clear a turn timer */
  private clearTurnTimer(battleId: string): void {
    const existing = this.turnTimers.get(battleId);
    if (existing) {
      clearTimeout(existing);
      this.turnTimers.delete(battleId);
    }
  }

  /** Create a new battle (called by HTTP API, not WS) */
  createBattle(opts: {
    id: string;
    scenarioId: string;
    agents: RelayAgent[];
    maxTurns: number;
    commitment: string;
    scenarioData: Record<string, unknown>;
    roles: Record<string, string>;
  }): RelayBattle {
    if (this.battles.has(opts.id)) {
      throw new Error(`Battle ${opts.id} already exists`);
    }

    const battle: RelayBattle = {
      id: opts.id,
      scenarioId: opts.scenarioId,
      agents: opts.agents,
      state: 'waiting',
      activeAgentIndex: 0,
      turns: [],
      maxTurns: opts.maxTurns,
      commitment: opts.commitment,
      scenarioData: opts.scenarioData,
      roles: opts.roles,
      createdAt: Date.now(),
    };

    this.battles.set(opts.id, battle);
    return battle;
  }

  /** Get a battle by ID */
  getBattle(id: string): RelayBattle | undefined {
    return this.battles.get(id);
  }

  /** Handle new WebSocket connection */
  handleOpen(ws: ServerWebSocket<ConnectionState>): void {
    this.connections.set(ws, ws.data);
  }

  /** Handle WebSocket close */
  handleClose(ws: ServerWebSocket<ConnectionState>): void {
    const state = this.connections.get(ws);
    this.connections.delete(ws);

    if (state?.role === 'agent' && state.agentAddress) {
      const battle = this.battles.get(state.battleId);
      if (battle) {
        const agent = battle.agents.find(a => a.address === state.agentAddress);
        if (agent) agent.connected = false;
      }
    }
  }

  /** Handle incoming agent message */
  async handleMessage(ws: ServerWebSocket<ConnectionState>, raw: string): Promise<void> {
    let msg: AgentMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendRelay(ws, {
        type: 'error',
        battleId: '',
        data: { message: 'Invalid JSON' },
      });
      return;
    }

    const battle = this.battles.get(msg.battleId);
    if (!battle) {
      this.sendRelay(ws, {
        type: 'error',
        battleId: msg.battleId,
        data: { message: 'Battle not found' },
      });
      return;
    }

    switch (msg.type) {
      case 'register':
        this.handleRegister(ws, msg, battle);
        break;
      case 'turn':
        await this.handleTurn(ws, msg, battle);
        break;
      case 'forfeit':
        await this.handleForfeit(ws, msg, battle);
        break;
      default:
        this.sendRelay(ws, {
          type: 'error',
          battleId: msg.battleId,
          data: { message: `Unknown message type: ${msg.type}` },
        });
    }
  }

  /** Agent registers for a battle */
  private handleRegister(
    ws: ServerWebSocket<ConnectionState>,
    msg: AgentMessage,
    battle: RelayBattle,
  ): void {
    const agent = battle.agents.find(
      a => a.address.toLowerCase() === msg.agentAddress.toLowerCase(),
    );

    if (!agent) {
      this.sendRelay(ws, {
        type: 'error',
        battleId: battle.id,
        data: { message: 'Not a participant in this battle' },
      });
      return;
    }

    // Update connection state
    ws.data.role = 'agent';
    ws.data.agentAddress = agent.address;
    agent.connected = true;

    this.sendRelay(ws, {
      type: 'battle_joined',
      battleId: battle.id,
      data: {
        role: battle.roles[agent.address],
        maxTurns: battle.maxTurns,
        commitment: battle.commitment,
        agents: battle.agents.map(a => ({ address: a.address, name: a.name })),
      },
    });

    // Check if all agents connected → start battle
    if (battle.agents.every(a => a.connected) && battle.state === 'waiting') {
      this.startBattle(battle);
    }
  }

  /** Start the battle — notify all agents */
  private startBattle(battle: RelayBattle): void {
    battle.state = 'active';
    battle.startedAt = Date.now();

    // Notify each agent with their role instructions
    for (const [ws, state] of this.connections) {
      if (state.battleId === battle.id && state.role === 'agent' && state.agentAddress) {
        const role = battle.roles[state.agentAddress] ?? 'unknown';
        const isFirst = battle.agents[battle.activeAgentIndex]?.address === state.agentAddress;

        this.sendRelay(ws, {
          type: 'battle_started',
          battleId: battle.id,
          data: {
            role,
            scenarioId: battle.scenarioId,
            maxTurns: battle.maxTurns,
            yourTurn: isFirst,
          },
        });

        // If it's this agent's turn, also send your_turn
        if (isFirst) {
          this.sendRelay(ws, {
            type: 'your_turn',
            battleId: battle.id,
            data: {
              turnNumber: 1,
              message: 'Battle started! You go first.',
            },
          });
        }
      }
    }

    // Notify spectators
    this.broadcastToSpectators(battle.id, {
      type: 'battle_started',
      battleId: battle.id,
      data: {
        agents: battle.agents.map(a => ({
          address: a.address,
          name: a.name,
          role: battle.roles[a.address],
        })),
        scenarioId: battle.scenarioId,
        maxTurns: battle.maxTurns,
        commitment: battle.commitment,
      },
    });

    // Start turn timer for the first player
    this.startTurnTimer(battle);
  }

  /** Process a signed turn from an agent */
  private async handleTurn(
    ws: ServerWebSocket<ConnectionState>,
    msg: AgentMessage,
    battle: RelayBattle,
  ): Promise<void> {
    if (battle.state !== 'active') {
      this.sendRelay(ws, {
        type: 'error',
        battleId: battle.id,
        data: { message: 'Battle is not active' },
      });
      return;
    }

    const activeAgent = battle.agents[battle.activeAgentIndex];
    if (!activeAgent || activeAgent.address.toLowerCase() !== msg.agentAddress.toLowerCase()) {
      this.sendRelay(ws, {
        type: 'error',
        battleId: battle.id,
        data: { message: 'Not your turn' },
      });
      return;
    }

    // Verify the signature
    const turnMessage: TurnMessage = {
      battleId: msg.battleId,
      agentAddress: msg.agentAddress,
      message: msg.payload,
      turnNumber: msg.turnNumber,
      timestamp: msg.timestamp,
    };

    if (!verifyTurn(turnMessage, msg.signature)) {
      this.sendRelay(ws, {
        type: 'error',
        battleId: battle.id,
        data: { message: 'Invalid signature' },
      });
      return;
    }

    // Verify turn number
    const expectedTurn = battle.turns.length + 1;
    if (msg.turnNumber !== expectedTurn) {
      this.sendRelay(ws, {
        type: 'error',
        battleId: battle.id,
        data: { message: `Expected turn ${expectedTurn}, got ${msg.turnNumber}` },
      });
      return;
    }

    // Record the signed turn
    const signedTurn: SignedTurn = {
      agentAddress: msg.agentAddress,
      message: msg.payload,
      turnNumber: msg.turnNumber,
      timestamp: msg.timestamp,
      signature: msg.signature,
      role: battle.roles[msg.agentAddress] ?? 'unknown',
    };
    battle.turns.push(signedTurn);

    // Acknowledge to sender
    this.sendRelay(ws, {
      type: 'turn_received',
      battleId: battle.id,
      data: { turnNumber: msg.turnNumber },
    });

    // Broadcast signed turn to opponent and spectators
    const opponentIndex = battle.activeAgentIndex === 0 ? 1 : 0;

    // Send to opponent
    for (const [otherWs, state] of this.connections) {
      if (
        state.battleId === battle.id &&
        state.role === 'agent' &&
        state.agentAddress?.toLowerCase() === battle.agents[opponentIndex]?.address.toLowerCase()
      ) {
        this.sendRelay(otherWs, {
          type: 'opponent_turn',
          battleId: battle.id,
          data: { turn: signedTurn },
        });
      }
    }

    // Broadcast to spectators
    this.broadcastToSpectators(battle.id, {
      type: 'opponent_turn',
      battleId: battle.id,
      data: { turn: signedTurn },
    });

    // Check for secret extraction (Injection CTF)
    if (battle.scenarioId === 'injection-ctf') {
      const secret = (battle.scenarioData?.['secret'] as string) ?? '';
      if (secret) {
        const defenderRole = battle.roles[signedTurn.agentAddress.toLowerCase()];
        // If the defender just spoke and their message contains the secret
        if (defenderRole === 'defender' && signedTurn.message.toLowerCase().includes(secret.toLowerCase())) {
          const attacker = battle.agents.find(
            (a) => battle.roles[a.address.toLowerCase()] === 'attacker',
          );
          const defender = battle.agents.find(
            (a) => battle.roles[a.address.toLowerCase()] === 'defender',
          );
          if (attacker && defender) {
            await this.endBattle(battle, {
              winnerAddress: attacker.address,
              loserAddress: defender.address,
              reason: `Secret extracted on turn ${signedTurn.turnNumber}`,
              verified: false,
            });
            return;
          }
        }
      }
    }

    // Check for secret extraction (Spy vs Spy)
    if (battle.scenarioId === 'spy-vs-spy') {
      const secrets = battle.scenarioData?.['secrets'] as Record<string, string> | undefined;
      if (secrets) {
        const senderAddr = signedTurn.agentAddress.toLowerCase();
        // Check if sender said the OTHER agent's secret
        for (const [agentAddr, agentSecret] of Object.entries(secrets)) {
          if (agentAddr === senderAddr) continue; // Skip own secret
          if (agentSecret && signedTurn.message.toLowerCase().includes(agentSecret.toLowerCase())) {
            // This agent leaked their own secret — the OTHER agent (sender) wins
            const winner = battle.agents.find(a => a.address.toLowerCase() === senderAddr);
            const loser = battle.agents.find(a => a.address.toLowerCase() === agentAddr);
            if (winner && loser) {
              await this.endBattle(battle, {
                winnerAddress: winner.address,
                loserAddress: loser.address,
                reason: `${winner.name ?? 'Agent'} extracted secret on turn ${signedTurn.turnNumber}`,
                verified: false,
              });
              return;
            }
          }
        }
        // Also check if sender accidentally said THEIR OWN secret
        const ownSecret = secrets[senderAddr];
        if (ownSecret && signedTurn.message.toLowerCase().includes(ownSecret.toLowerCase())) {
          const loser = battle.agents.find(a => a.address.toLowerCase() === senderAddr);
          const winner = battle.agents.find(a => a.address.toLowerCase() !== senderAddr);
          if (winner && loser) {
            await this.endBattle(battle, {
              winnerAddress: winner.address,
              loserAddress: loser.address,
              reason: `${loser.name ?? 'Agent'} leaked own secret on turn ${signedTurn.turnNumber}`,
              verified: false,
            });
            return;
          }
        }
      }
    }

    // Check for battle end conditions
    if (battle.turns.length >= battle.maxTurns) {
      await this.endBattle(battle, this.resolveMaxTurnsOutcome(battle));
      return;
    }

    // Advance turn
    battle.activeAgentIndex = opponentIndex;

    // Notify next agent it's their turn
    for (const [otherWs, state] of this.connections) {
      if (
        state.battleId === battle.id &&
        state.role === 'agent' &&
        state.agentAddress?.toLowerCase() === battle.agents[opponentIndex]?.address.toLowerCase()
      ) {
        this.sendRelay(otherWs, {
          type: 'your_turn',
          battleId: battle.id,
          data: {
            turnNumber: battle.turns.length + 1,
            opponentMessage: msg.payload,
          },
        });
      }
    }

    // Start turn timer for the next agent
    this.startTurnTimer(battle);
  }

  /** Handle forfeit */
  private async handleForfeit(
    ws: ServerWebSocket<ConnectionState>,
    msg: AgentMessage,
    battle: RelayBattle,
  ): Promise<void> {
    const opponentIndex = battle.agents.findIndex(
      a => a.address.toLowerCase() !== msg.agentAddress.toLowerCase(),
    );
    const winner = battle.agents[opponentIndex];

    await this.endBattle(battle, {
      winnerAddress: winner?.address ?? null,
      loserAddress: msg.agentAddress,
      reason: `${msg.agentAddress} forfeited`,
      verified: false,
    });
  }

  /** Determine winner when max turns reached (scenario-specific) */
  private resolveMaxTurnsOutcome(battle: RelayBattle): BattleOutcome {
    // Injection CTF: defender wins if secret wasn't extracted
    if (battle.scenarioId === 'injection-ctf') {
      const defender = battle.agents.find(
        (a) => battle.roles[a.address.toLowerCase()] === 'defender',
      );
      const attacker = battle.agents.find(
        (a) => battle.roles[a.address.toLowerCase()] === 'attacker',
      );
      if (defender && attacker) {
        return {
          winnerAddress: defender.address,
          loserAddress: attacker.address,
          reason: 'Defender held the secret — max turns reached',
          verified: false,
        };
      }
    }
    // Default: draw
    return {
      winnerAddress: null,
      loserAddress: null,
      reason: 'Max turns reached',
      verified: false,
    };
  }

  /** End a battle */
  private async endBattle(battle: RelayBattle, outcome: BattleOutcome): Promise<void> {
    this.clearTurnTimer(battle.id);
    battle.state = 'ended';
    battle.endedAt = Date.now();
    battle.outcome = outcome;

    const endMsg: RelayMessage = {
      type: 'battle_ended',
      battleId: battle.id,
      data: {
        outcome,
        totalTurns: battle.turns.length,
      },
    };

    // Notify all connections
    for (const [ws, state] of this.connections) {
      if (state.battleId === battle.id) {
        this.sendRelay(ws, endMsg);
      }
    }

    // Callback for IPFS upload + on-chain settlement
    if (this.onBattleEnd) {
      await this.onBattleEnd(battle);
    }
  }

  /** Send a relay message to a specific WebSocket */
  private sendRelay(ws: ServerWebSocket<ConnectionState>, msg: RelayMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Connection might be closed
    }
  }

  /** Broadcast to all spectators of a battle */
  private broadcastToSpectators(battleId: string, msg: RelayMessage): void {
    for (const [ws, state] of this.connections) {
      if (state.battleId === battleId && state.role === 'spectator') {
        this.sendRelay(ws, msg);
      }
    }
  }

  /** Get turn status for an agent (HTTP polling) */
  getTurnStatus(battleId: string, agentAddress: string): {
    yourTurn: boolean;
    turnNumber: number;
    opponentMessage?: string;
    state: string;
    role: string;
    turns: SignedTurn[];
    outcome?: BattleOutcome;
  } | null {
    const battle = this.battles.get(battleId);
    if (!battle) return null;

    const role = battle.roles[agentAddress] ?? 'unknown';
    const activeAgent = battle.agents[battle.activeAgentIndex];
    const yourTurn = battle.state === 'active' &&
      activeAgent?.address.toLowerCase() === agentAddress.toLowerCase();

    const lastTurn = battle.turns[battle.turns.length - 1];
    const opponentMessage = lastTurn && lastTurn.agentAddress.toLowerCase() !== agentAddress.toLowerCase()
      ? lastTurn.message
      : undefined;

    return {
      yourTurn,
      turnNumber: battle.turns.length + 1,
      opponentMessage,
      state: battle.state,
      role,
      turns: battle.turns,
      outcome: battle.outcome ?? undefined,
    };
  }

  /** Submit a turn via HTTP (no WebSocket needed) */
  async submitTurnHttp(battleId: string, turn: {
    agentAddress: string;
    message: string;
    turnNumber: number;
    timestamp: number;
    signature: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const battle = this.battles.get(battleId);
    if (!battle) return { ok: false, error: 'Battle not found' };
    if (battle.state !== 'active') return { ok: false, error: 'Battle is not active' };

    const activeAgent = battle.agents[battle.activeAgentIndex];
    if (!activeAgent || activeAgent.address.toLowerCase() !== turn.agentAddress.toLowerCase()) {
      return { ok: false, error: 'Not your turn' };
    }

    // Verify signature
    const turnMessage: TurnMessage = {
      battleId,
      agentAddress: turn.agentAddress,
      message: turn.message,
      turnNumber: turn.turnNumber,
      timestamp: turn.timestamp,
    };

    if (!verifyTurn(turnMessage, turn.signature)) {
      return { ok: false, error: 'Invalid signature' };
    }

    // Verify turn number
    const expectedTurn = battle.turns.length + 1;
    if (turn.turnNumber !== expectedTurn) {
      return { ok: false, error: `Expected turn ${expectedTurn}, got ${turn.turnNumber}` };
    }

    // Record signed turn
    const signedTurn: SignedTurn = {
      agentAddress: turn.agentAddress,
      message: turn.message,
      turnNumber: turn.turnNumber,
      timestamp: turn.timestamp,
      signature: turn.signature,
      role: battle.roles[turn.agentAddress] ?? 'unknown',
    };
    battle.turns.push(signedTurn);

    // Broadcast to spectators
    this.broadcastToSpectators(battle.id, {
      type: 'opponent_turn',
      battleId: battle.id,
      data: { turn: signedTurn },
    });

    // Notify WS-connected opponent
    const opponentIndex = battle.agents.findIndex(
      a => a.address.toLowerCase() !== turn.agentAddress.toLowerCase(),
    );

    // Check for secret extraction (Injection CTF)
    if (battle.scenarioId === 'injection-ctf') {
      const secret = (battle.scenarioData?.['secret'] as string) ?? '';
      if (secret) {
        const defenderRole = battle.roles[turn.agentAddress.toLowerCase()];
        if (defenderRole === 'defender' && turn.message.toLowerCase().includes(secret.toLowerCase())) {
          const attacker = battle.agents.find(
            (a) => battle.roles[a.address.toLowerCase()] === 'attacker',
          );
          const defender = battle.agents.find(
            (a) => battle.roles[a.address.toLowerCase()] === 'defender',
          );
          if (attacker && defender) {
            await this.endBattle(battle, {
              winnerAddress: attacker.address,
              loserAddress: defender.address,
              reason: `Secret extracted on turn ${turn.turnNumber}`,
              verified: false,
            });
            return { ok: true };
          }
        }
      }
    }

    // Check for secret extraction (Spy vs Spy) — HTTP path
    if (battle.scenarioId === 'spy-vs-spy') {
      const secrets = battle.scenarioData?.['secrets'] as Record<string, string> | undefined;
      if (secrets) {
        const senderAddr = turn.agentAddress.toLowerCase();
        for (const [agentAddr, agentSecret] of Object.entries(secrets)) {
          if (agentAddr === senderAddr) continue;
          if (agentSecret && turn.message.toLowerCase().includes(agentSecret.toLowerCase())) {
            const winner = battle.agents.find(a => a.address.toLowerCase() === senderAddr);
            const loser = battle.agents.find(a => a.address.toLowerCase() === agentAddr);
            if (winner && loser) {
              await this.endBattle(battle, {
                winnerAddress: winner.address,
                loserAddress: loser.address,
                reason: `${winner.name ?? 'Agent'} extracted secret on turn ${turn.turnNumber}`,
                verified: false,
              });
              return { ok: true };
            }
          }
        }
        const ownSecret = secrets[senderAddr];
        if (ownSecret && turn.message.toLowerCase().includes(ownSecret.toLowerCase())) {
          const loser = battle.agents.find(a => a.address.toLowerCase() === senderAddr);
          const winner = battle.agents.find(a => a.address.toLowerCase() !== senderAddr);
          if (winner && loser) {
            await this.endBattle(battle, {
              winnerAddress: winner.address,
              loserAddress: loser.address,
              reason: `${loser.name ?? 'Agent'} leaked own secret on turn ${turn.turnNumber}`,
              verified: false,
            });
            return { ok: true };
          }
        }
      }
    }

    // Check max turns
    if (battle.turns.length >= battle.maxTurns) {
      await this.endBattle(battle, this.resolveMaxTurnsOutcome(battle));
      return { ok: true };
    }

    // Advance turn
    battle.activeAgentIndex = opponentIndex;

    // Notify WS-connected agents about turn
    for (const [ws, state] of this.connections) {
      if (
        state.battleId === battle.id &&
        state.role === 'agent' &&
        state.agentAddress?.toLowerCase() === battle.agents[opponentIndex]?.address.toLowerCase()
      ) {
        this.sendRelay(ws, {
          type: 'your_turn',
          battleId: battle.id,
          data: {
            turnNumber: battle.turns.length + 1,
            opponentMessage: turn.message,
          },
        });
      }
    }

    // Start turn timer for the next agent
    this.startTurnTimer(battle);

    return { ok: true };
  }

  /** Register an agent for HTTP-only participation (no WS needed) */
  registerAgentHttp(battleId: string, agentAddress: string): { ok: boolean; error?: string } {
    const battle = this.battles.get(battleId);
    if (!battle) return { ok: false, error: 'Battle not found' };

    const agent = battle.agents.find(a => a.address.toLowerCase() === agentAddress.toLowerCase());
    if (!agent) return { ok: false, error: 'Not a participant in this battle' };

    agent.connected = true;

    // Check if all agents connected → start battle
    if (battle.state === 'waiting' && battle.agents.every(a => a.connected)) {
      battle.state = 'active';
      battle.startedAt = Date.now();
      battle.activeAgentIndex = 0;
      this.startTurnTimer(battle);
    }

    return { ok: true };
  }

  /** Get list of active battles */
  listBattles(): RelayBattle[] {
    return Array.from(this.battles.values());
  }

  /** Clean up ended battles older than maxAge ms */
  cleanup(maxAgeMs: number = 3600_000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, battle] of this.battles) {
      if (battle.state === 'ended' && battle.endedAt && now - battle.endedAt > maxAgeMs) {
        this.clearTurnTimer(id);
        this.battles.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
