// Arena Waku Broadcaster — publishes turn data to Waku for live spectating
//
// Usage:
//   const broadcast = createWakuBroadcaster({ nwakuRestUrl: 'http://127.0.0.1:8003' });
//   const fighter = new ArenaFighter({ ..., onTurnBroadcast: broadcast });
//
// Spectators subscribe via js-waku in the browser to receive turns instantly.
// On-chain events remain the source of truth; Waku is the fast lane.

import type { ArenaTurnBroadcast } from './arena-fighter.ts';

/** Waku message envelope for Arena turn broadcasts */
export interface WakuArenaTurn {
  type: 'arena_turn';
  battleId: string;
  agent: string;
  turnNumber: number;
  message: string;
  txHash: string;
  timestamp: number;
}

/** Configuration for the Waku broadcaster */
export interface WakuBroadcasterConfig {
  /** nwaku REST API URL */
  nwakuRestUrl: string;
  /** Cluster ID (default: 42) */
  clusterId?: number;
  /** Shard index (default: 0) */
  shardId?: number;
}

const DEFAULT_CLUSTER_ID = 42;
const DEFAULT_SHARD_ID = 0;

/** Build content topic for arena battle spectating */
export function arenaTopic(battleId: string): string {
  return `/clawttack/1/arena-${battleId}/proto`;
}

/** Build pubsub topic */
function pubsubTopic(clusterId: number, shardId: number): string {
  return `/waku/2/rs/${clusterId}/${shardId}`;
}

/**
 * Create a Waku broadcaster function for ArenaFighter.onTurnBroadcast.
 *
 * Publishes turn data to nwaku REST API so spectators can receive
 * near-instant updates via Waku subscriptions.
 */
export function createWakuBroadcaster(config: WakuBroadcasterConfig) {
  const { nwakuRestUrl } = config;
  const clusterId = config.clusterId ?? DEFAULT_CLUSTER_ID;
  const shardId = config.shardId ?? DEFAULT_SHARD_ID;
  const topic = pubsubTopic(clusterId, shardId);

  return async (turn: ArenaTurnBroadcast): Promise<void> => {
    const contentTopic = arenaTopic(turn.battleId);

    const wakuMessage: WakuArenaTurn = {
      type: 'arena_turn',
      battleId: turn.battleId,
      agent: turn.agent,
      turnNumber: turn.turnNumber,
      message: turn.message,
      txHash: turn.txHash,
      timestamp: Date.now(),
    };

    const payload = Buffer.from(JSON.stringify(wakuMessage)).toString('base64');
    const encodedTopic = encodeURIComponent(topic);

    const res = await fetch(`${nwakuRestUrl}/relay/v1/messages/${encodedTopic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, contentTopic }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Waku broadcast failed: ${res.status} ${body}`);
    }
  };
}
