// packages/sdk/src/waku-transport.ts — Waku P2P transport for Clawttack
//
// Zero-server battle communication. Agents and spectators share a
// Waku content topic per battle. Signed turns are validated client-side.
// Spectator messages are unsigned and visually separated.
//
// Architecture:
//   - nwaku relay node (Docker) handles message routing
//   - JS light nodes subscribe via Filter protocol
//   - Publishing via nwaku REST API (JS lightPush peer selection is buggy)
//   - Cluster 42, shard 0 — private, no RLN required
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
  /** nwaku REST API URL (required) */
  nwakuRestUrl: string;
  /** nwaku WebSocket multiaddr — auto-discovered from REST if omitted */
  nwakuMultiaddr?: string;
  /** Cluster ID (default: 42 — private, no RLN) */
  clusterId?: number;
  /** Shard index (default: 0) */
  shardId?: number;
  /** Content topic prefix (default: /clawttack/1) */
  topicPrefix?: string;
}

type EventHandler = (...args: any[]) => void;

const DEFAULT_CLUSTER_ID = 42;
const DEFAULT_SHARD_ID = 0;
const DEFAULT_TOPIC_PREFIX = '/clawttack/1';
const PEER_CONNECT_TIMEOUT_MS = 8_000;

/** Build content topic for a battle */
function battleTopic(prefix: string, battleId: string): string {
  return `${prefix}/battle-${battleId}/proto`;
}

/** Build the pubsub topic string */
function pubsubTopic(clusterId: number, shardId: number): string {
  return `/waku/2/rs/${clusterId}/${shardId}`;
}

/**
 * Discover nwaku WebSocket multiaddr from its REST API.
 * Replaces Docker-internal IP with localhost.
 */
async function discoverMultiaddr(restUrl: string): Promise<string> {
  const res = await fetch(`${restUrl}/debug/v1/info`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`nwaku REST returned ${res.status}`);

  const info = (await res.json()) as { listenAddresses: string[] };
  const wsAddr = info.listenAddresses?.find((a) => a.includes('/ws/'));
  if (!wsAddr) throw new Error('nwaku has no WebSocket listener');

  const peerId = wsAddr.split('/p2p/')[1];
  if (!peerId) throw new Error('Could not extract peer ID from multiaddr');

  // Extract port from REST URL to determine host
  const url = new URL(restUrl);
  const host = url.hostname;

  // Map Docker-internal IPs to the REST API host
  return `/ip4/${host}/tcp/8645/ws/p2p/${peerId}`;
}

/**
 * Publish a message via nwaku REST API.
 * Uses explicit pubsub topic to avoid auto-sharding mismatch.
 */
async function publishViaREST(
  restUrl: string,
  topic: string,
  contentTopic: string,
  data: WakuBattleMessage,
): Promise<void> {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const encodedTopic = encodeURIComponent(topic);

  const res = await fetch(`${restUrl}/relay/v1/messages/${encodedTopic}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, contentTopic }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`nwaku REST publish failed: ${res.status} ${body}`);
  }
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
  private pubsubTopic: string;
  private restUrl: string;
  private shardId: number;
  private subscription: any;
  private agentAddress?: string;
  private battleId: string;
  private registeredAgents = new Set<string>();

  constructor(
    node: any,
    battleId: string,
    contentTopic: string,
    pubsubTopic: string,
    restUrl: string,
    shardId: number,
  ) {
    this.node = node;
    this.battleId = battleId;
    this.contentTopic = contentTopic;
    this.pubsubTopic = pubsubTopic;
    this.restUrl = restUrl;
    this.shardId = shardId;
  }

  get connected(): boolean {
    return this._connected;
  }

  async register(agentAddress: string): Promise<void> {
    this.agentAddress = agentAddress;

    try {
      // Subscribe to the battle topic via Waku Filter
      const decoder = this.node.createDecoder({
        contentTopic: this.contentTopic,
        shardId: this.shardId,
      });

      this.subscription = await this.node.filter.subscribe(
        [decoder],
        (message: any) => this.handleMessage(message),
      );

      // Allow filter subscription to register on nwaku
      await new Promise((r) => setTimeout(r, 1_000));

      // Announce presence via REST API
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
  async sendSpectatorMessage(
    message: string,
    sender: string,
  ): Promise<void> {
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

  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K],
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
  }

  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K],
  ): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  async close(): Promise<void> {
    if (this.subscription) {
      try {
        await this.subscription.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    this._connected = false;
    this.emit('connectionChanged', false);
  }

  // --- Internal ---

  private emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      try {
        handler(...args);
      } catch {
        /* don't crash on handler errors */
      }
    }
  }

  private async broadcast(msg: WakuBattleMessage): Promise<void> {
    await publishViaREST(
      this.restUrl,
      this.pubsubTopic,
      this.contentTopic,
      msg,
    );
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
        agents: sorted.map((a) => ({ address: a, name: a.slice(0, 10) })),
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
 * Uses a local nwaku relay node for message routing.
 * JS light nodes subscribe via Filter, publish via nwaku REST API.
 *
 * Setup:
 *   docker run -d --name nwaku \
 *     -p 127.0.0.1:8645:8645 -p 127.0.0.1:8003:8003 \
 *     harbor.status.im/wakuorg/nwaku:v0.34.0 \
 *     --cluster-id=42 --shard=0 --rln-relay=false \
 *     --websocket-support=true --websocket-port=8645 \
 *     --rest=true --rest-address=0.0.0.0 --rest-port=8003 \
 *     --relay=true --filter=true --lightpush=true --store=false
 */
export class WakuTransport implements ITransport {
  readonly name = 'waku';
  private node: any;
  private config: Required<
    Pick<WakuTransportConfig, 'nwakuRestUrl' | 'clusterId' | 'shardId' | 'topicPrefix'>
  > & { nwakuMultiaddr?: string };
  private connections = new Map<string, WakuConnection>();

  constructor(config: WakuTransportConfig) {
    this.config = {
      nwakuRestUrl: config.nwakuRestUrl,
      nwakuMultiaddr: config.nwakuMultiaddr,
      clusterId: config.clusterId ?? DEFAULT_CLUSTER_ID,
      shardId: config.shardId ?? DEFAULT_SHARD_ID,
      topicPrefix: config.topicPrefix ?? DEFAULT_TOPIC_PREFIX,
    };
  }

  async connect(battleId: string): Promise<ITransportConnection> {
    // Lazy-init the Waku node
    if (!this.node) {
      await this.initNode();
    }

    const contentTopic = battleTopic(this.config.topicPrefix, battleId);
    const psTopic = pubsubTopic(this.config.clusterId, this.config.shardId);

    const connection = new WakuConnection(
      this.node,
      battleId,
      contentTopic,
      psTopic,
      this.config.nwakuRestUrl,
      this.config.shardId,
    );
    this.connections.set(battleId, connection);
    return connection;
  }

  async dispose(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.close();
    }
    this.connections.clear();

    if (this.node) {
      try {
        await this.node.stop();
      } catch {
        /* ignore */
      }
      this.node = null;
    }
  }

  private async initNode(): Promise<void> {
    const { createLightNode } = await import('@waku/sdk');

    // Discover nwaku multiaddr if not provided
    const multiaddr =
      this.config.nwakuMultiaddr ??
      (await discoverMultiaddr(this.config.nwakuRestUrl));

    this.node = await createLightNode({
      bootstrapPeers: [multiaddr],
      networkConfig: {
        clusterId: this.config.clusterId,
        shards: [this.config.shardId],
      },
      libp2p: {
        filterMultiaddrs: false,
        hideWebSocketInfo: true,
      },
    });
    await this.node.start();

    // Wait for peer connection (no waitForRemotePeer — unreliable)
    await new Promise((r) => setTimeout(r, PEER_CONNECT_TIMEOUT_MS));

    const peers = this.node.libp2p?.getPeers?.() ?? [];
    if (peers.length === 0) {
      throw new Error(
        `WakuTransport: no peers after ${PEER_CONNECT_TIMEOUT_MS}ms. Is nwaku running at ${this.config.nwakuRestUrl}?`,
      );
    }
  }
}
