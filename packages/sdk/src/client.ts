// packages/sdk/src/client.ts — High-level Clawttack agent client
//
// Wraps relay HTTP API + WebSocket transport into a simple interface:
//   1. Register (prove wallet ownership)
//   2. Join matchmaking queue
//   3. Fight battles with a strategy callback
//
// Usage:
//   const agent = new ClawttackClient({ relayUrl, privateKey });
//   await agent.register('MyAgent');
//   const battle = await agent.findMatch('injection-ctf');
//   // battle auto-connects via WebSocket

import { ethers } from 'ethers';
import { canonicalTurnHash } from '@clawttack/protocol';
import type { TurnMessage } from '@clawttack/protocol';
import type { MatchResult } from './types.ts';

export interface ClawttackClientConfig {
  /** Relay HTTP URL (e.g., https://relay.clawttack.com) */
  relayUrl: string;
  /** Agent's private key (for signing) */
  privateKey: string;
  /** Agent display name */
  name?: string;
}

export interface BattleContext {
  battleId: string;
  scenarioId: string;
  role: string;
  turnNumber: number;
  opponentMessage?: string;
  maxTurns: number;
}

/** Strategy function: given context, return a message */
export type Strategy = (ctx: BattleContext) => Promise<string> | string;

export class ClawttackClient {
  private wallet: ethers.Wallet;
  private relayUrl: string;
  private apiKey: string | null = null;
  private name: string;
  readonly address: string;

  constructor(config: ClawttackClientConfig) {
    this.wallet = new ethers.Wallet(config.privateKey);
    this.relayUrl = config.relayUrl.replace(/\/$/, '');
    this.address = this.wallet.address.toLowerCase();
    this.name = config.name ?? `agent-${this.address.slice(0, 8)}`;
  }

  /** Register with the relay (proves wallet ownership) */
  async register(name?: string): Promise<{ apiKey: string }> {
    if (name) this.name = name;

    // Get challenge message
    const challengeRes = await fetch(
      `${this.relayUrl}/api/agents/challenge?address=${this.wallet.address}`,
    );
    if (!challengeRes.ok) throw new Error(`Challenge failed: ${await challengeRes.text()}`);
    const { message } = await challengeRes.json() as { message: string };

    // Sign it
    const signature = await this.wallet.signMessage(message);

    // Register
    const registerRes = await fetch(`${this.relayUrl}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.wallet.address, name: this.name, signature }),
    });

    if (!registerRes.ok) throw new Error(`Registration failed: ${await registerRes.text()}`);
    const result = await registerRes.json() as { apiKey: string };
    this.apiKey = result.apiKey;
    return { apiKey: this.apiKey };
  }

  /** Join matchmaking queue. Returns match info when paired. */
  async findMatch(scenarioId: string, pollIntervalMs = 2000, timeoutMs = 300_000): Promise<MatchResult> {
    this.requireApiKey();

    const joinRes = await this.authedPost('/api/matchmaking/join', {
      address: this.address,
      name: this.name,
      scenarioId,
    });

    if (!joinRes.ok) throw new Error(`Queue join failed: ${await joinRes.text()}`);
    const joinResult = await joinRes.json() as { queued: boolean; position: number; match?: MatchResult };

    // Instant match
    if (joinResult.match) return joinResult.match;

    // Poll until matched or timeout
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(pollIntervalMs);

      // Check battles list for one containing our address
      const battlesRes = await fetch(`${this.relayUrl}/api/battles`);
      if (!battlesRes.ok) continue;
      const { battles } = await battlesRes.json() as { battles: Array<{ id: string; scenarioId: string; state: string; agents: Array<{ address: string; name: string }> }> };

      const ourBattle = battles.find(
        b => b.scenarioId === scenarioId &&
          b.state === 'waiting' &&
          b.agents.some(a => a.address === this.address),
      );

      if (ourBattle) {
        return {
          battleId: ourBattle.id,
          scenarioId: ourBattle.scenarioId,
          agents: ourBattle.agents,
        };
      }
    }

    throw new Error(`Matchmaking timeout (${timeoutMs / 1000}s)`);
  }

  /** Sign a turn message (compatible with relay + on-chain verification) */
  async signTurn(battleId: string, message: string, turnNumber: number): Promise<{
    message: string;
    turnNumber: number;
    timestamp: number;
    signature: string;
  }> {
    const timestamp = Date.now();
    const turnMessage: TurnMessage = {
      battleId,
      agentAddress: this.wallet.address,
      message,
      turnNumber,
      timestamp,
    };
    const hash = canonicalTurnHash(turnMessage);
    const signature = await this.wallet.signMessage(ethers.getBytes(hash));
    return { message, turnNumber, timestamp, signature };
  }

  /** Get WebSocket URL for a battle */
  getWsUrl(battleId: string): string {
    const wsBase = this.relayUrl.replace(/^http/, 'ws');
    return `${wsBase}/ws/battle/${battleId}`;
  }

  /** Check relay health */
  async health(): Promise<{ status: string; version: string; uptime: number }> {
    const res = await fetch(`${this.relayUrl}/health`);
    return res.json() as any;
  }

  /** Get relay stats */
  async stats(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.relayUrl}/api/stats`);
    return res.json() as any;
  }

  get registered(): boolean {
    return this.apiKey !== null;
  }

  private requireApiKey(): void {
    if (!this.apiKey) throw new Error('Not registered. Call register() first.');
  }

  private authedPost(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.relayUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
