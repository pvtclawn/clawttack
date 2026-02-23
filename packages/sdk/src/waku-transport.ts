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

import { ethers } from 'ethers';
import { canonicalTurnHash, verifyTurn } from '@clawttack/protocol';
import type { TurnMessage } from '@clawttack/protocol';
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
  /** Turn timeout in ms — auto-forfeit opponent if they don't respond (default: 60000) */
  turnTimeoutMs?: number;
  /**
   * Dynamic turn timeout function — overrides turnTimeoutMs when set.
   * Receives the current turn number, returns timeout in ms.
   * Use with ChallengeWordBattle's decreasing timer.
   */
  turnTimeoutFn?: (turnNumber: number) => number;
}

type EventHandler = (...args: any[]) => void;

const DEFAULT_CLUSTER_ID = 42;
const DEFAULT_SHARD_ID = 0;
const DEFAULT_TOPIC_PREFIX = '/clawttack/1';
const PEER_CONNECT_TIMEOUT_MS = 8_000;
const DEFAULT_TURN_TIMEOUT_MS = 60_000;

/**
 * Verify that a registration message was signed by the claimed address.
 * Uses EIP-191 personal sign over: "clawttack:register:{battleId}:{address}:{timestamp}"
 */
function verifyRegistrationSig(
  battleId: string,
  address: string,
  timestamp: number,
  signature: string,
): boolean {
  try {
    const message = `clawttack:register:${battleId}:${address.toLowerCase()}:${timestamp}`;
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Create a registration signature proving address ownership.
 */
export async function signRegistration(
  wallet: ethers.Wallet,
  battleId: string,
  timestamp: number,
): Promise<string> {
  const message = `clawttack:register:${battleId}:${wallet.address.toLowerCase()}:${timestamp}`;
  return wallet.signMessage(message);
}

/**
 * Create a forfeit signature proving the agent actually chose to forfeit.
 * Prevents third-party forfeit injection on the Waku topic.
 */
export async function signForfeit(
  wallet: ethers.Wallet,
  battleId: string,
  timestamp: number,
): Promise<string> {
  const message = `clawttack:forfeit:${battleId}:${wallet.address.toLowerCase()}:${timestamp}`;
  return wallet.signMessage(message);
}

/**
 * Verify a forfeit signature.
 */
function verifyForfeitSig(
  battleId: string,
  address: string,
  timestamp: number,
  signature: string,
): boolean {
  try {
    const message = `clawttack:forfeit:${battleId}:${address.toLowerCase()}:${timestamp}`;
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

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
  // Prevent duplicate battleStarted emissions
  private battleStartedEmitted = false;
  // M4.5.3: Turn ordering + duplicate rejection
  private lastReceivedTurnNumber = 0;
  private receivedTurnNumbers = new Set<number>();
  // M4.5.4: Turn timeout
  private turnTimeoutMs: number;
  /** Dynamic timeout — set by WakuTransport from config.turnTimeoutFn */
  turnTimeoutFn?: (turnNumber: number) => number;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  // Registration signature (for signed registration)
  private registrationSignature?: string;
  // When true, register() skips filter subscription (managed by WakuTransport)
  _skipFilterSubscribe = false;
  /** Optional forfeit signer — set by WakuFighter to enable signed forfeits */
  _forfeitSigner?: (battleId: string, timestamp: number) => Promise<string>;

  constructor(
    node: any,
    battleId: string,
    contentTopic: string,
    pubsubTopic: string,
    restUrl: string,
    shardId: number,
    turnTimeoutMs: number = DEFAULT_TURN_TIMEOUT_MS,
  ) {
    this.node = node;
    this.battleId = battleId;
    this.contentTopic = contentTopic;
    this.pubsubTopic = pubsubTopic;
    this.restUrl = restUrl;
    this.shardId = shardId;
    this.turnTimeoutMs = turnTimeoutMs;
  }

  get connected(): boolean {
    return this._connected;
  }

  async register(agentAddress: string, signature?: string, signedTimestamp?: number): Promise<void> {
    this.agentAddress = agentAddress;
    this.registrationSignature = signature;
    // Add self to registered agents (handleMessage skips own messages,
    // so we won't see our own registration via filter)
    this.registeredAgents.add(agentAddress);

    try {
      if (!this._skipFilterSubscribe) {
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
      }

      // Use the same timestamp that was signed (if provided)
      const timestamp = signedTimestamp ?? Date.now();

      // Announce presence via REST API (with signature if provided)
      await this.broadcast({
        type: 'register',
        battleId: this.battleId,
        sender: agentAddress,
        timestamp,
        payload: { agentAddress },
        signature, // M4.5.2: Signed registration
      });

      this._connected = true;
      this.emit('connectionChanged', true);

      // Check if we already have enough agents (from messages received
      // before we set agentAddress — the handleRegister condition
      // requires agentAddress to be set)
      if (this.registeredAgents.size >= 2 && this.agentAddress && !this.battleStartedEmitted) {
        this.battleStartedEmitted = true;
        const sorted = [...this.registeredAgents].sort();
        const yourTurn = sorted[0] === this.agentAddress;
        this.emit('battleStarted', {
          battleId: this.battleId,
          role: 'spy',
          scenarioId: 'spy-vs-spy',
          maxTurns: 20,
          yourTurn,
          commitment: '',
          agents: sorted.map((a) => ({ address: a, name: a.slice(0, 10) })),
        } satisfies BattleStartData);

        if (!yourTurn) {
          this.resetTurnTimer();
        }
      }

      // Re-broadcast registration after delays to handle race conditions.
      // Always re-broadcast at least once — the initial broadcast may arrive
      // before the shared filter subscription is fully active on nwaku.
      // Second re-broadcast only if battle hasn't started yet.
      setTimeout(async () => {
        if (this._connected) {
          await this.broadcast({
            type: 'register',
            battleId: this.battleId,
            sender: agentAddress,
            timestamp,
            payload: { agentAddress },
            signature,
          }).catch(() => {}); // Best effort
        }
      }, 2_000);
      setTimeout(async () => {
        if (this.registeredAgents.size < 2 && this._connected) {
          await this.broadcast({
            type: 'register',
            battleId: this.battleId,
            sender: agentAddress,
            timestamp,
            payload: { agentAddress },
            signature,
          }).catch(() => {}); // Best effort
        }
      }, 5_000);
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

    // M4.5.4: After sending our turn, start timer for opponent's response
    this.resetTurnTimer();
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

    const timestamp = Date.now();
    // Sign the forfeit if a signer is available (M4.5 hardening)
    const signature = this._forfeitSigner
      ? await this._forfeitSigner(this.battleId, timestamp)
      : undefined;

    await this.broadcast({
      type: 'system',
      battleId: this.battleId,
      sender: this.agentAddress,
      timestamp,
      payload: { action: 'forfeit' },
      signature,
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
    this.clearTurnTimer();
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

  /** M4.5.4: Start/reset the turn timeout timer */
  private resetTurnTimer(): void {
    this.clearTurnTimer();
    // Dynamic timeout: use turnTimeoutFn if available, else static turnTimeoutMs
    const nextTurn = this.lastReceivedTurnNumber + 1;
    const timeoutMs = this.turnTimeoutFn
      ? this.turnTimeoutFn(nextTurn)
      : this.turnTimeoutMs;
    if (timeoutMs <= 0) return;

    this.turnTimer = setTimeout(() => {
      // Opponent didn't respond in time — they forfeit
      this.emit('battleEnded', {
        totalTurns: this.lastReceivedTurnNumber,
        outcome: {
          winnerAddress: this.agentAddress ?? null,
          loserAddress: null, // Unknown — opponent just timed out
          reason: 'timeout',
        },
      } satisfies BattleEndData);
    }, timeoutMs);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

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

  /** Receive a message from WakuTransport's centralized subscription */
  _handleExternalMessage(wakuMessage: any): void {
    this.handleMessage(wakuMessage);
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

    // M4.5.2: Verify registration signature if present
    if (msg.signature) {
      const valid = verifyRegistrationSig(
        this.battleId,
        addr,
        msg.timestamp,
        msg.signature,
      );
      if (!valid) {
        this.emit('error', `Registration from ${addr.slice(0, 10)} has invalid signature — rejected`);
        return;
      }
    }
    // If no signature, still accept (backward compat) but log warning
    // Future: require signatures always

    this.registeredAgents.add(addr);

    // If two agents registered, battle can start
    if (this.registeredAgents.size >= 2 && this.agentAddress && !this.battleStartedEmitted) {
      this.battleStartedEmitted = true;
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

      // M4.5.4: Start turn timer (the agent who goes second waits for first turn)
      if (!yourTurn) {
        this.resetTurnTimer();
      }
    }
  }

  private handleTurn(msg: WakuBattleMessage): void {
    const turnNumber = msg.payload.turnNumber as number;
    const message = msg.payload.message as string;

    // Reject turns from unregistered agents (prevents third-party injection)
    if (!this.registeredAgents.has(msg.sender)) {
      this.emit('error', `Turn from unregistered agent ${msg.sender.slice(0, 10)} — rejected`);
      return;
    }

    // M4.5.3: Reject duplicate turns
    if (this.receivedTurnNumbers.has(turnNumber)) {
      this.emit('error', `Duplicate turn ${turnNumber} from ${msg.sender.slice(0, 10)} — rejected`);
      return;
    }

    // M4.5.3: Reject out-of-order turns (must be > last received)
    if (turnNumber <= this.lastReceivedTurnNumber) {
      this.emit('error', `Out-of-order turn ${turnNumber} (last: ${this.lastReceivedTurnNumber}) — rejected`);
      return;
    }

    // M4.5.1: Verify ECDSA signature
    if (!msg.signature) {
      this.emit('error', `Turn ${turnNumber} from ${msg.sender.slice(0, 10)} has no signature — rejected`);
      return;
    }

    const turnMessage: TurnMessage = {
      battleId: this.battleId,
      agentAddress: msg.sender,
      message,
      turnNumber,
      timestamp: msg.timestamp,
    };

    if (!verifyTurn(turnMessage, msg.signature)) {
      this.emit('error', `Turn ${turnNumber} from ${msg.sender.slice(0, 10)} has INVALID signature — rejected`);
      return;
    }

    // All checks passed — accept the turn
    this.lastReceivedTurnNumber = turnNumber;
    this.receivedTurnNumbers.add(turnNumber);

    // M4.5.4: Reset turn timer (opponent responded, clock resets for next turn)
    this.clearTurnTimer();

    this.emit('opponentTurn', {
      agentAddress: msg.sender,
      message,
      turnNumber,
      timestamp: msg.timestamp,
      signature: msg.signature,
      role: 'spy',
      battleId: this.battleId,
    });

    this.emit('yourTurn', {
      turnNumber: turnNumber + 1,
      opponentMessage: message,
    } satisfies YourTurnData);

    // M4.5.4: Start turn timer for OUR response (we need to reply in time)
    // Note: this times out if WE don't send, but the timer is really
    // about the opponent's next turn. We reset when we send our own turn.
    // For now, start timer — it'll be cleared when opponent's next turn arrives.
  }

  private handleSystem(msg: WakuBattleMessage): void {
    if (msg.payload.action === 'forfeit') {
      // Only accept forfeit from registered agents
      if (!this.registeredAgents.has(msg.sender)) {
        this.emit('error', `Forfeit from unregistered agent ${msg.sender.slice(0, 10)} — rejected`);
        return;
      }

      // M4.5: Verify forfeit signature if present (prevents third-party injection)
      if (msg.signature) {
        const valid = verifyForfeitSig(
          this.battleId,
          msg.sender,
          msg.timestamp,
          msg.signature,
        );
        if (!valid) {
          this.emit('error', `Forfeit from ${msg.sender.slice(0, 10)} has INVALID signature — rejected`);
          return;
        }
      }
      // Accept unsigned forfeits for backward compat (e.g., timeout-triggered)
      // Future: require signature always

      this.clearTurnTimer();
      this.emit('battleEnded', {
        totalTurns: this.lastReceivedTurnNumber,
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
    Pick<WakuTransportConfig, 'nwakuRestUrl' | 'clusterId' | 'shardId' | 'topicPrefix' | 'turnTimeoutMs'>
  > & { nwakuMultiaddr?: string };
  private connections = new Map<string, WakuConnection>();
  // Shared subscriptions: one filter sub per content topic, fan out to all connections
  private topicSubscriptions = new Map<string, { sub: any; connectionIds: Set<string> }>();
  private connectionCounter = 0;
  private initPromise: Promise<void> | null = null;

  constructor(config: WakuTransportConfig) {
    this.config = {
      nwakuRestUrl: config.nwakuRestUrl,
      nwakuMultiaddr: config.nwakuMultiaddr,
      clusterId: config.clusterId ?? DEFAULT_CLUSTER_ID,
      shardId: config.shardId ?? DEFAULT_SHARD_ID,
      topicPrefix: config.topicPrefix ?? DEFAULT_TOPIC_PREFIX,
      turnTimeoutMs: config.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
    };
  }

  async connect(battleId: string): Promise<ITransportConnection> {
    // Lazy-init the Waku node (with guard against concurrent init)
    if (!this.node) {
      if (!this.initPromise) {
        this.initPromise = this.initNode();
      }
      await this.initPromise;
    }

    const contentTopic = battleTopic(this.config.topicPrefix, battleId);
    const psTopic = pubsubTopic(this.config.clusterId, this.config.shardId);

    // Unique connection ID (supports multiple connections to same battle)
    const connId = `${battleId}-${this.connectionCounter++}`;

    const connection = new WakuConnection(
      this.node,
      battleId,
      contentTopic,
      psTopic,
      this.config.nwakuRestUrl,
      this.config.shardId,
      this.config.turnTimeoutMs,
    );
    // Pass through dynamic timeout function if configured
    if (this.config.turnTimeoutFn) {
      connection.turnTimeoutFn = this.config.turnTimeoutFn;
    }
    this.connections.set(connId, connection);

    // Set up shared subscription for this content topic
    const existingEntry = this.topicSubscriptions.get(contentTopic);
    if (existingEntry) {
      // Subscription already exists — just add this connection to fan-out
      existingEntry.connectionIds.add(connId);
    } else {
      // Reserve the entry BEFORE async work (prevents race with concurrent connect())
      const entry = { sub: null as any, connectionIds: new Set([connId]) };
      this.topicSubscriptions.set(contentTopic, entry);

      const decoder = this.node.createDecoder({
        contentTopic,
        shardId: this.config.shardId,
      });

      entry.sub = await this.node.filter.subscribe(
        [decoder],
        (message: any) => this.fanOutMessage(contentTopic, message),
      );

      // Wait for filter subscription to register on nwaku
      await new Promise((r) => setTimeout(r, 1_000));
    }

    // Override connection's register to skip its own filter subscribe
    // (WakuTransport handles subscription centrally)
    connection._skipFilterSubscribe = true;

    return connection;
  }

  async dispose(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.close();
    }
    this.connections.clear();

    // Clean up shared subscriptions
    for (const { sub } of this.topicSubscriptions.values()) {
      try { await sub?.unsubscribe?.(); } catch { /* ignore */ }
    }
    this.topicSubscriptions.clear();

    if (this.node) {
      try {
        await this.node.stop();
      } catch {
        /* ignore */
      }
      this.node = null;
    }
  }

  /** Fan out a received Waku message to all connections subscribed to this content topic */
  private fanOutMessage(contentTopic: string, wakuMessage: any): void {
    const topicSub = this.topicSubscriptions.get(contentTopic);
    if (!topicSub) return;

    for (const connId of topicSub.connectionIds) {
      const conn = this.connections.get(connId);
      if (conn) {
        conn._handleExternalMessage(wakuMessage);
      }
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
