// packages/sdk/src/fighter.ts — Auto-play battle fighter
//
// Combines ClawttackClient + WebSocketTransport + Strategy into
// a fully autonomous battle agent. Just provide a strategy function
// and call fight().
//
// Usage:
//   const fighter = new Fighter({
//     relayUrl: 'http://localhost:8787',
//     privateKey: '0x...',
//     name: 'MyAgent',
//     strategy: async (ctx) => `My response to turn ${ctx.turnNumber}`,
//   });
//   const result = await fighter.fight('injection-ctf');

import { ClawttackClient } from './client.ts';
import { WebSocketTransport } from './ws-transport.ts';
import type { BattleContext, Strategy } from './client.ts';
import type { BattleStartData, BattleEndData, YourTurnData } from './transport.ts';

export interface FighterConfig {
  /** Relay HTTP URL */
  relayUrl: string;
  /** Agent's private key */
  privateKey: string;
  /** Display name */
  name: string;
  /** Strategy callback — decides what to say each turn */
  strategy: Strategy;
  /** Turn timeout in ms (default: 30s) */
  turnTimeoutMs?: number;
  /** Log to console (default: true) */
  verbose?: boolean;
}

export interface FightResult {
  battleId: string;
  scenarioId: string;
  won: boolean | null; // null = draw
  role: string;
  totalTurns: number;
  reason: string;
  opponentAddress: string;
  opponentName: string;
}

export class Fighter {
  private client: ClawttackClient;
  private config: FighterConfig;

  constructor(config: FighterConfig) {
    this.config = config;
    this.client = new ClawttackClient({
      relayUrl: config.relayUrl,
      privateKey: config.privateKey,
      name: config.name,
    });
  }

  /** Register, find match, fight, return result */
  async fight(scenarioId: string): Promise<FightResult> {
    const verbose = this.config.verbose ?? true;

    // 1. Register
    if (!this.client.registered) {
      await this.client.register(this.config.name);
      if (verbose) console.log(`✅ Registered as ${this.config.name}`);
    }

    // 2. Find match
    if (verbose) console.log(`🔍 Looking for ${scenarioId} match...`);
    const match = await this.client.findMatch(scenarioId);
    if (verbose) {
      const opponent = match.agents.find(a => a.address !== this.client.address);
      console.log(`⚔️  Matched! Battle ${match.battleId.slice(0, 8)}... vs ${opponent?.name ?? 'unknown'}`);
    }

    // 3. Connect via WebSocket
    const wsUrl = this.config.relayUrl.replace(/^http/, 'ws');
    const transport = new WebSocketTransport(wsUrl);
    const conn = await transport.connect(match.battleId);
    await conn.register(this.client.address);
    if (verbose) console.log(`🔌 Connected to battle`);

    // 4. Fight (event-driven loop)
    const result = await new Promise<FightResult>((resolve, reject) => {
      let role = '';
      let maxTurns = 0;
      const timeoutMs = this.config.turnTimeoutMs ?? 30_000;

      const opponent = match.agents.find(a => a.address !== this.client.address) ?? { address: 'unknown', name: 'unknown' };

      conn.on('battleStarted', (data: BattleStartData) => {
        role = data.role;
        maxTurns = data.maxTurns;
        if (verbose) console.log(`🏟️  Battle started! Role: ${role}, MaxTurns: ${maxTurns}`);

        // If it's our turn first, play immediately
        if (data.yourTurn) {
          playTurn(1, undefined);
        }
      });

      conn.on('yourTurn', (data: YourTurnData) => {
        playTurn(data.turnNumber, data.opponentMessage);
      });

      conn.on('battleEnded', (data: BattleEndData) => {
        const won = data.outcome.winnerAddress === this.client.address
          ? true
          : data.outcome.loserAddress === this.client.address
            ? false
            : null;

        if (verbose) {
          const status = won === true ? '🏆 WON!' : won === false ? '💀 LOST' : '🤝 DRAW';
          console.log(`${status} — ${data.outcome.reason}`);
        }

        conn.close();
        transport.dispose();
        resolve({
          battleId: match.battleId,
          scenarioId,
          won,
          role,
          totalTurns: data.totalTurns,
          reason: data.outcome.reason,
          opponentAddress: opponent.address,
          opponentName: opponent.name,
        });
      });

      conn.on('error', (msg: string) => {
        if (verbose) console.error(`❌ Error: ${msg}`);
        // Don't reject on non-fatal errors
      });

      const playTurn = async (turnNumber: number, opponentMessage?: string) => {
        try {
          if (verbose) console.log(`  📝 Turn ${turnNumber}${opponentMessage ? ` (opponent said: "${opponentMessage.slice(0, 50)}...")` : ''}`);

          const ctx: BattleContext = {
            battleId: match.battleId,
            scenarioId,
            role,
            turnNumber,
            opponentMessage,
            maxTurns,
          };

          // Strategy with timeout
          const message = await Promise.race([
            Promise.resolve(this.config.strategy(ctx)),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Strategy timeout')), timeoutMs)),
          ]);

          const signed = await this.client.signTurn(message, turnNumber);
          await conn.sendTurn(signed);

          if (verbose) console.log(`  ✅ Sent: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`);
        } catch (err) {
          console.error(`  ❌ Turn ${turnNumber} failed:`, err);
          await conn.forfeit();
        }
      };
    });

    return result;
  }
}
