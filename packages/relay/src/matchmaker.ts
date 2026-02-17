// packages/relay/src/matchmaker.ts — Simple matchmaking queue
//
// Agents join a queue for a specific scenario. When enough agents
// are queued (usually 2), a battle is automatically created.

import { ethers } from 'ethers';
import type { RelayServer } from './server.ts';
import type { AgentRegistry } from './agent-registry.ts';

export interface QueueEntry {
  address: string;
  name: string;
  joinedAt: number;
}

export interface MatchResult {
  battleId: string;
  scenarioId: string;
  agents: Array<{ address: string; name: string }>;
}

export interface MatchmakerConfig {
  /** Secrets pool for Injection CTF (randomly picked) */
  secrets?: string[];
  /** Default max turns per battle */
  maxTurns?: number;
  /** Queue timeout — remove agents after this many ms (default: 5 min) */
  queueTimeoutMs?: number;
  /** Callback when a match is made */
  onMatch?: (match: MatchResult) => void;
}

export class Matchmaker {
  private queues = new Map<string, QueueEntry[]>(); // scenarioId → queue
  private relay: RelayServer;
  private config: MatchmakerConfig;
  private cleanupTimer: Timer | null = null;

  constructor(relay: RelayServer, config: MatchmakerConfig = {}) {
    this.relay = relay;
    this.config = config;
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => this.cleanupStale(), 30_000);
  }

  /** Join the matchmaking queue for a scenario */
  join(scenarioId: string, address: string, name: string): { queued: boolean; position: number; match?: MatchResult } {
    const normalized = address.toLowerCase();

    // Check if already in any queue
    for (const [sid, queue] of this.queues) {
      if (queue.some(e => e.address === normalized)) {
        return { queued: false, position: queue.findIndex(e => e.address === normalized) + 1 };
      }
    }

    // Add to queue
    if (!this.queues.has(scenarioId)) {
      this.queues.set(scenarioId, []);
    }
    const queue = this.queues.get(scenarioId)!;
    queue.push({ address: normalized, name, joinedAt: Date.now() });

    const playerCount = this.getPlayerCount(scenarioId);

    // Check if we have enough players to match
    if (queue.length >= playerCount) {
      const matched = queue.splice(0, playerCount);
      const match = this.createMatch(scenarioId, matched);
      return { queued: true, position: 0, match };
    }

    return { queued: true, position: queue.length };
  }

  /** Leave the matchmaking queue */
  leave(address: string): boolean {
    const normalized = address.toLowerCase();
    for (const [, queue] of this.queues) {
      const idx = queue.findIndex(e => e.address === normalized);
      if (idx !== -1) {
        queue.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  /** Get queue status */
  status(): Record<string, { count: number; entries: Array<{ address: string; name: string; waitingSec: number }> }> {
    const result: Record<string, { count: number; entries: Array<{ address: string; name: string; waitingSec: number }> }> = {};
    const now = Date.now();
    for (const [scenarioId, queue] of this.queues) {
      result[scenarioId] = {
        count: queue.length,
        entries: queue.map(e => ({
          address: e.address,
          name: e.name,
          waitingSec: Math.round((now - e.joinedAt) / 1000),
        })),
      };
    }
    return result;
  }

  /** Remove stale entries */
  private cleanupStale(): void {
    const timeout = this.config.queueTimeoutMs ?? 300_000; // 5 min default
    const now = Date.now();
    for (const [, queue] of this.queues) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (now - queue[i]!.joinedAt > timeout) {
          queue.splice(i, 1);
        }
      }
    }
  }

  /** Create a match from queued agents */
  private createMatch(scenarioId: string, agents: QueueEntry[]): MatchResult {
    const maxTurns = this.config.maxTurns ?? 8;
    const secret = this.pickSecret();
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
    const battleId = crypto.randomUUID();

    // Assign roles based on scenario
    const roles: Record<string, string> = {};
    if (scenarioId === 'injection-ctf') {
      // Random attacker/defender assignment
      const shuffled = [...agents].sort(() => Math.random() - 0.5);
      roles[shuffled[0]!.address] = 'attacker';
      roles[shuffled[1]!.address] = 'defender';
    } else if (scenarioId === 'spy-vs-spy') {
      // Symmetric — both are spies
      roles[agents[0]!.address] = 'spy';
      roles[agents[1]!.address] = 'spy';
    } else {
      // Symmetric scenarios — player1/player2
      agents.forEach((a, i) => { roles[a.address] = `player${i + 1}`; });
    }

    // Build scenario-specific data
    let scenarioData: Record<string, unknown> = {};
    let commitment = secretHash;

    if (scenarioId === 'injection-ctf') {
      scenarioData = { secret };
    } else if (scenarioId === 'spy-vs-spy') {
      const secretB = this.pickSecret();
      const secretHashB = ethers.keccak256(ethers.toUtf8Bytes(secretB));
      scenarioData = {
        secrets: {
          [agents[0]!.address.toLowerCase()]: secret,
          [agents[1]!.address.toLowerCase()]: secretB,
        },
      };
      // Commitment = hash of both secret hashes
      commitment = ethers.keccak256(ethers.solidityPacked(
        ['bytes32', 'bytes32'],
        [secretHash, secretHashB],
      ));
    }

    // Create battle on relay
    this.relay.createBattle({
      id: battleId,
      scenarioId,
      agents: agents.map(a => ({ address: a.address, name: a.name, connected: false })),
      maxTurns,
      commitment,
      scenarioData,
      roles,
    });

    const match: MatchResult = {
      battleId,
      scenarioId,
      agents: agents.map(a => ({ address: a.address, name: a.name })),
    };

    this.config.onMatch?.(match);
    console.log(`  🎲 Match made: ${agents.map(a => a.name).join(' vs ')} (${scenarioId}) → ${battleId}`);

    return match;
  }

  /** Get required player count for a scenario */
  private getPlayerCount(scenarioId: string): number {
    // All current scenarios are 2-player
    return 2;
  }

  private pickSecret(): string {
    const pool = this.config.secrets;
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)]!;
    }
    // Generate dynamic secret: 4 random words from a larger set
    const words = [
      'crimson', 'velvet', 'phantom', 'sapphire', 'ember', 'obsidian', 'amber', 'cobalt',
      'neon', 'iron', 'silver', 'golden', 'crystal', 'shadow', 'frost', 'storm',
      'lighthouse', 'thunder', 'echo', 'clockwork', 'cascade', 'whisper', 'labyrinth', 'sentinel',
      'glacier', 'phoenix', 'forge', 'atlas', 'maze', 'bloom', 'peak', 'tide',
      'spark', 'drift', 'thread', 'hollow', 'winter', 'solar', 'frozen', 'silent',
      'raven', 'copper', 'jade', 'mercury', 'onyx', 'pearl', 'quartz', 'ruby',
      'apex', 'cipher', 'delta', 'helix', 'orbit', 'prism', 'nexus', 'vertex',
    ];
    const picked: string[] = [];
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * words.length);
      picked.push(words[idx]!);
    }
    return picked.join(' ');
  }

  /** Cleanup timers on shutdown */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
