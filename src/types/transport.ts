// src/types/transport.ts — Transport-agnostic interface for battle communication
//
// The transport layer is a dumb pipe. It delivers signed messages
// between agents. The protocol doesn't care HOW messages get there —
// WebSocket, Waku, Matrix, carrier pigeons — as long as they arrive
// signed and in order.

import type { SignedTurn } from './relay.ts';

/** Events emitted by a transport connection */
export interface TransportEvents {
  /** Battle is ready, both agents connected */
  battleStarted: (data: BattleStartData) => void;
  /** It's your turn — includes opponent's last message if any */
  yourTurn: (data: YourTurnData) => void;
  /** Your turn was acknowledged */
  turnAccepted: (turnNumber: number) => void;
  /** Opponent sent a signed turn */
  opponentTurn: (turn: SignedTurn) => void;
  /** Battle ended */
  battleEnded: (data: BattleEndData) => void;
  /** Error occurred */
  error: (message: string) => void;
  /** Connection state changed */
  connectionChanged: (connected: boolean) => void;
}

export interface BattleStartData {
  battleId: string;
  role: string;
  scenarioId: string;
  maxTurns: number;
  yourTurn: boolean;
  commitment: string;
  agents: Array<{ address: string; name: string }>;
}

export interface YourTurnData {
  turnNumber: number;
  opponentMessage?: string;
}

export interface BattleEndData {
  totalTurns: number;
  outcome: {
    winnerAddress: string | null;
    loserAddress: string | null;
    reason: string;
  };
}

/** Transport connection for a single battle */
export interface ITransportConnection {
  /** Register as a participant in the battle */
  register(agentAddress: string): Promise<void>;

  /** Send a signed turn */
  sendTurn(turn: {
    message: string;
    turnNumber: number;
    timestamp: number;
    signature: string;
  }): Promise<void>;

  /** Forfeit the battle */
  forfeit(): Promise<void>;

  /** Subscribe to transport events */
  on<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void;

  /** Unsubscribe from transport events */
  off<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void;

  /** Close the connection */
  close(): Promise<void>;

  /** Whether the connection is currently active */
  readonly connected: boolean;
}

/**
 * Transport factory — creates connections to battles.
 *
 * Implementations:
 * - WebSocketTransport: connects to a relay server via WS
 * - WakuTransport: connects via Waku P2P network (future)
 * - DirectTransport: connects directly to another agent (testing)
 */
export interface ITransport {
  /** Transport identifier */
  readonly name: string;

  /** Connect to a battle */
  connect(battleId: string): Promise<ITransportConnection>;

  /** Disconnect all connections and clean up */
  dispose(): Promise<void>;
}
