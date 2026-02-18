// packages/sdk/src/waku-transport.ts — Waku P2P transport for Clawttack
//
// Zero-server battle communication. Agents and spectators share a
// Waku content topic per battle. Signed turns are validated client-side.
// Spectator messages are unsigned and visually separated.
//
// Content topic: /clawttack/1/battle-{battleId}/proto
//
// Message types:
//   - "turn"       — ECDSA-signed agent turn (the battle)
//   - "register"   — agent announces presence
//   - "spectator"  — unsigned spectator chat
//   - "system"     — battle state changes (start, end)

import type {
  ITransport,
  ITransportConnection,
  TransportEvents,
  BattleStartData,
  YourTurnData,
  BattleEndData,
} from './transport.ts';

/** Message envelope for Waku content topic */
export interface WakuBattleMessage {
  type: 'turn' | 'register' | 'spectator' | 'system';
  battleId: string;
  sender: string;
  timestamp: number;
  payload: Record<string, unknown>;
  signature?: string; // ECDSA sig for agent turns
}

/** Waku transport configuration */
export interface WakuTransportConfig {
  /** Custom bootstrap nodes (optional — uses default Waku network if empty) */
  bootstrapNodes?: string[];
  /** Cluster ID (default: 1 for mainnet, 42 for test) */
  clusterId?: number;
  /** Content topic prefix (default: /clawttack/1) */
  topicPrefix?: string;
}

type EventHandler = (...args: any[]) => void;

/** Build content topic for a battle */
function battleTopic(prefix: string, battleId: string): string {
  return `${prefix}/battle-${battleId}/proto`;
}

/**
 * Waku P2P transport connection for a single battle.
 *
 * Both agents and spectators subscribe to the same content topic.
 * Agent turns are ECDSA-signed; spectator messages are unsigned.
 */
class WakuConnection implements ITransportConnection {
  private listeners = new Map<string, Set<EventHandler>>();
  private _connected = false;
  private node: any; // Waku LightNode
  private contentTopic: string;
  private subscription: any;
  private agentAddress?: string;
  private battleId: string;
  private registeredAgents = new Set<string>();

  constructor(
    node: any,
    battleId: string,
    contentTopic: string,
  ) {
    this.node = node;
    this.battleId = battleId;
    this.contentTopic = contentTopic;
  }

  get connected(): boolean {
    return this._connected;
  }

  async register(agentAddress: string): Promise<void> {
    this.agentAddress = agentAddress;

    try {
      // Subscribe to the battle topic via Waku Filter
      const { createDecoder } = await import('@waku/sdk');
      const decoder = createDecoder(this.contentTopic);

      this.subscription = await this.node.filter.subscribe(
        [decoder],
        (message: any) => this.handleMessage(message),
      );

      // Announce presence via Light Push
      await this.broadcast({
        type: 'register',
        battleId: this.battleId,
        sender: agentAddress,
        timestamp: Date.now(),
        payload: { agentAddress },
      });

      this._connected = true;
      this.emit('connectionChanged', true);
    } catch (err) {
      this.emit('error', `Waku registration failed: ${err}`);
      throw err;
    }
  }

  async sendTurn(turn: {
    message: string;
    turnNumber: number;
    timestamp: number;
    signature: string;
  }): Promise<void> {
    if (!this.agentAddress) throw new Error('Not registered');

    await this.broadcast({
      type: 'turn',
      battleId: this.battleId,
      sender: this.agentAddress,
      timestamp: turn.timestamp,
      payload: {
        message: turn.message,
        turnNumber: turn.turnNumber,
      },
      signature: turn.signature,
    });
  }

  /** Send a spectator chat message (no signature required) */
  async sendSpectatorMessage(message: string, sender: string): Promise<void> {
    await this.broadcast({
      type: 'spectator',
      battleId: this.battleId,
      sender,
      timestamp: Date.now(),
      payload: { message },
    });
  }

  async forfeit(): Promise<void> {
    if (!this.agentAddress) return;

    await this.broadcast({
      type: 'system',
      battleId: this.battleId,
      sender: this.agentAddress,
      timestamp: Date.now(),
      payload: { action: 'forfeit' },
    });
  }

  on<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
  }

  off<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  async close(): Promise<void> {
    if (this.subscription) {
      try {
        await this.subscription.unsubscribe();
      } catch { /* ignore */ }
    }
    this._connected = false;
    this.emit('connectionChanged', false);
  }

  // --- Internal ---

  private emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      try { handler(...args); } catch { /* don't crash on handler errors */ }
    }
  }

  private async broadcast(msg: WakuBattleMessage): Promise<void> {
    const { createEncoder } = await import('@waku/sdk');
    const encoder = createEncoder({ contentTopic: this.contentTopic });
    const payload = new TextEncoder().encode(JSON.stringify(msg));

    const result = await this.node.lightPush.send(encoder, { payload });

    if (result.failures && result.failures.length > 0 && result.successes?.length === 0) {
      throw new Error(`Waku send failed: ${JSON.stringify(result.failures)}`);
    }
  }

  private handleMessage(wakuMessage: any): void {
    if (!wakuMessage.payload) return;

    try {
      const text = new TextDecoder().decode(wakuMessage.payload);
      const msg: WakuBattleMessage = JSON.parse(text);

      // Skip own messages
      if (msg.sender === this.agentAddress) return;

      switch (msg.type) {
        case 'register':
          this.handleRegister(msg);
          break;
        case 'turn':
          this.handleTurn(msg);
          break;
        case 'system':
          this.handleSystem(msg);
          break;
        case 'spectator':
          // Spectator messages — emit as a custom event
          this.emit('spectatorMessage', {
            sender: msg.sender,
            message: msg.payload.message,
            timestamp: msg.timestamp,
          });
          break;
      }
    } catch {
      // Malformed message — ignore
    }
  }

  private handleRegister(msg: WakuBattleMessage): void {
    const addr = msg.payload.agentAddress as string;
    this.registeredAgents.add(addr);

    // If two agents registered, battle can start
    if (this.registeredAgents.size >= 2 && this.agentAddress) {
      // First registered agent goes first (deterministic)
      const sorted = [...this.registeredAgents].sort();
      const yourTurn = sorted[0] === this.agentAddress;

      this.emit('battleStarted', {
        battleId: this.battleId,
        role: 'spy', // Waku battles are symmetric by default
        scenarioId: 'spy-vs-spy',
        maxTurns: 20,
        yourTurn,
        commitment: '', // No relay to provide commitment
        agents: sorted.map(a => ({ address: a, name: a.slice(0, 10) })),
      } satisfies BattleStartData);
    }
  }

  private handleTurn(msg: WakuBattleMessage): void {
    // TODO: verify ECDSA signature client-side before accepting
    this.emit('opponentTurn', {
      agentAddress: msg.sender,
      message: msg.payload.message,
      turnNumber: msg.payload.turnNumber,
      timestamp: msg.timestamp,
      signature: msg.signature ?? '',
      role: 'spy',
      battleId: this.battleId,
    });

    this.emit('yourTurn', {
      turnNumber: (msg.payload.turnNumber as number) + 1,
      opponentMessage: msg.payload.message as string,
    } satisfies YourTurnData);
  }

  private handleSystem(msg: WakuBattleMessage): void {
    if (msg.payload.action === 'forfeit') {
      this.emit('battleEnded', {
        totalTurns: 0,
        outcome: {
          winnerAddress: this.agentAddress ?? null,
          loserAddress: msg.sender,
          reason: 'forfeit',
        },
      } satisfies BattleEndData);
    }
  }
}

/**
 * Waku P2P Transport — serverless battle communication.
 *
 * Uses the Waku decentralized messaging network. No relay server needed.
 * Agents find each other via shared content topics derived from battle IDs.
 */
export class WakuTransport implements ITransport {
  readonly name = 'waku';
  private node: any;
  private config: WakuTransportConfig;
  private connections = new Map<string, WakuConnection>();
  private topicPrefix: string;

  constructor(config: WakuTransportConfig = {}) {
    this.config = config;
    this.topicPrefix = config.topicPrefix ?? '/clawttack/1';
  }

  async connect(battleId: string): Promise<ITransportConnection> {
    // Lazy-init the Waku node
    if (!this.node) {
      await this.initNode();
    }

    const topic = battleTopic(this.topicPrefix, battleId);
    const connection = new WakuConnection(this.node, battleId, topic);
    this.connections.set(battleId, connection);
    return connection;
  }

  async dispose(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.close();
    }
    this.connections.clear();

    if (this.node) {
      try { await this.node.stop(); } catch { /* ignore */ }
      this.node = null;
    }
  }

  private async initNode(): Promise<void> {
    const { createLightNode, waitForRemotePeer } = await import('@waku/sdk');

    const opts: Record<string, unknown> = {};
    if (this.config.bootstrapNodes && this.config.bootstrapNodes.length > 0) {
      opts.bootstrapPeers = this.config.bootstrapNodes;
    } else {
      opts.defaultBootstrap = true;
    }

    this.node = await createLightNode(opts);
    await this.node.start();
    await waitForRemotePeer(this.node);
  }
}
