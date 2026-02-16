// src/transport/ws.ts — WebSocket transport implementation
//
// Connects to a Clawttack relay server via WebSocket.
// This is the v1 transport — works today, tested, reliable.

import type {
  ITransport,
  ITransportConnection,
  TransportEvents,
  BattleStartData,
  YourTurnData,
  BattleEndData,
} from '../types/transport.ts';
import type { RelayMessage, SignedTurn } from '../types/relay.ts';

type EventMap = {
  [K in keyof TransportEvents]: Set<TransportEvents[K]>;
};

class WebSocketConnection implements ITransportConnection {
  private ws: WebSocket;
  private battleId: string;
  private agentAddress: string = '';
  private listeners: Partial<EventMap> = {};
  private _connected = false;

  constructor(ws: WebSocket, battleId: string) {
    this.ws = ws;
    this.battleId = battleId;
    this._connected = ws.readyState === WebSocket.OPEN;

    ws.addEventListener('open', () => {
      this._connected = true;
      this.emit('connectionChanged', true);
    });

    ws.addEventListener('close', () => {
      this._connected = false;
      this.emit('connectionChanged', false);
    });

    ws.addEventListener('error', () => {
      this.emit('error', 'WebSocket connection error');
    });

    ws.addEventListener('message', (event) => {
      this.handleMessage(event.data as string);
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  async register(agentAddress: string): Promise<void> {
    this.agentAddress = agentAddress;
    this.send({
      type: 'register',
      battleId: this.battleId,
      agentAddress,
      payload: '',
      turnNumber: 0,
      timestamp: Date.now(),
      signature: '',
    });
  }

  async sendTurn(turn: {
    message: string;
    turnNumber: number;
    timestamp: number;
    signature: string;
  }): Promise<void> {
    this.send({
      type: 'turn',
      battleId: this.battleId,
      agentAddress: this.agentAddress,
      payload: turn.message,
      turnNumber: turn.turnNumber,
      timestamp: turn.timestamp,
      signature: turn.signature,
    });
  }

  async forfeit(): Promise<void> {
    this.send({
      type: 'forfeit',
      battleId: this.battleId,
      agentAddress: this.agentAddress,
      payload: '',
      turnNumber: 0,
      timestamp: Date.now(),
      signature: '',
    });
  }

  on<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as EventMap[K];
    }
    (this.listeners[event] as Set<TransportEvents[K]>).add(handler);
  }

  off<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    (this.listeners[event] as Set<TransportEvents[K]> | undefined)?.delete(handler);
  }

  async close(): Promise<void> {
    this.ws.close();
    this._connected = false;
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private emit<K extends keyof TransportEvents>(event: K, ...args: Parameters<TransportEvents[K]>): void {
    const handlers = this.listeners[event] as Set<(...a: Parameters<TransportEvents[K]>) => void> | undefined;
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Transport event handler error (${event}):`, e);
        }
      }
    }
  }

  private handleMessage(raw: string): void {
    let msg: RelayMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.emit('error', 'Invalid message from relay');
      return;
    }

    switch (msg.type) {
      case 'battle_started':
        this.emit('battleStarted', msg.data as unknown as BattleStartData);
        break;
      case 'your_turn':
        this.emit('yourTurn', msg.data as unknown as YourTurnData);
        break;
      case 'turn_received':
        this.emit('turnAccepted', (msg.data as { turnNumber: number }).turnNumber);
        break;
      case 'opponent_turn':
        this.emit('opponentTurn', (msg.data as { turn: SignedTurn }).turn);
        break;
      case 'battle_ended':
        this.emit('battleEnded', msg.data as unknown as BattleEndData);
        break;
      case 'error':
        this.emit('error', (msg.data as { message: string }).message);
        break;
    }
  }
}

/** WebSocket transport — connects to a Clawttack relay server */
export class WebSocketTransport implements ITransport {
  readonly name = 'websocket';
  private relayUrl: string;
  private connections: WebSocketConnection[] = [];

  constructor(relayUrl: string) {
    // Normalize URL: ensure ws:// or wss://
    this.relayUrl = relayUrl.replace(/\/$/, '');
  }

  async connect(battleId: string): Promise<ITransportConnection> {
    const url = `${this.relayUrl}/ws/battle/${battleId}`;
    const ws = new WebSocket(url);

    // Wait for connection to open
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        ws.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        ws.removeEventListener('open', onOpen);
        reject(new Error(`Failed to connect to ${url}`));
      };
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('error', onError, { once: true });
    });

    const connection = new WebSocketConnection(ws, battleId);
    this.connections.push(connection);
    return connection;
  }

  async dispose(): Promise<void> {
    await Promise.all(this.connections.map(c => c.close()));
    this.connections = [];
  }
}
