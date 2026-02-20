/**
 * battle-state.ts — Local battle state persistence for fight.ts
 *
 * Saves seeds, battle IDs, and roles to a local JSON file so that
 * crashed/interrupted sessions can resume without creating ghost battles.
 *
 * State file: .clawttack-state.json (configurable)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Hex, Address } from 'viem';

// --- Types ---

export interface BattleStateEntry {
  /** The on-chain battle ID */
  battleId: Hex;
  /** Our secret seed (needed for reveal) */
  seed: string;
  /** Our commit hash */
  commit: Hex;
  /** Whether we created or accepted this battle */
  role: 'challenger' | 'opponent';
  /** Our wallet address */
  agent: Address;
  /** The arena contract address */
  arena: Address;
  /** ISO timestamp of when this entry was created */
  createdAt: string;
  /** Current known phase (updated as battle progresses) */
  phase: 'open' | 'committed' | 'active' | 'settled' | 'cancelled';
  /** Stake in wei (as string for JSON serialization) */
  stakeWei: string;
}

export interface BattleStateFile {
  /** Version for forward-compat */
  version: 1;
  /** Active battles keyed by battleId */
  battles: Record<string, BattleStateEntry>;
}

// --- Constants ---

const DEFAULT_STATE_PATH = '.clawttack-state.json';

// --- BattleStateManager ---

export class BattleStateManager {
  private filePath: string;
  private state: BattleStateFile;

  constructor(filePath?: string) {
    this.filePath = resolve(filePath ?? DEFAULT_STATE_PATH);
    this.state = this.load();
  }

  /** Load state from disk, or create empty state */
  private load(): BattleStateFile {
    if (!existsSync(this.filePath)) {
      return { version: 1, battles: {} };
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as BattleStateFile;

      if (parsed.version !== 1) {
        throw new Error(`Unsupported state file version: ${parsed.version}`);
      }
      if (!parsed.battles || typeof parsed.battles !== 'object') {
        throw new Error('Invalid state file: missing battles');
      }

      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load state file ${this.filePath}: ${msg}`);
    }
  }

  /** Write current state to disk atomically(ish) */
  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2) + '\n', 'utf-8');
  }

  /** Save a new battle entry (on create or accept) */
  saveBattle(entry: BattleStateEntry): void {
    this.state.battles[entry.battleId] = entry;
    this.save();
  }

  /** Update the phase of an existing battle */
  updatePhase(battleId: Hex, phase: BattleStateEntry['phase']): void {
    const entry = this.state.battles[battleId];
    if (entry) {
      entry.phase = phase;
      this.save();
    }
  }

  /** Get a battle entry by ID */
  getBattle(battleId: Hex): BattleStateEntry | undefined {
    return this.state.battles[battleId];
  }

  /** Get all battles matching a filter */
  listBattles(filter?: {
    agent?: Address;
    arena?: Address;
    phase?: BattleStateEntry['phase'];
  }): BattleStateEntry[] {
    let entries = Object.values(this.state.battles);

    if (filter?.agent) {
      const agentLower = filter.agent.toLowerCase();
      entries = entries.filter((e) => e.agent.toLowerCase() === agentLower);
    }
    if (filter?.arena) {
      const arenaLower = filter.arena.toLowerCase();
      entries = entries.filter((e) => e.arena.toLowerCase() === arenaLower);
    }
    if (filter?.phase) {
      entries = entries.filter((e) => e.phase === filter.phase);
    }

    return entries;
  }

  /** Find resumable battles (open or committed — need seed reveal or opponent) */
  findResumable(agent: Address, arena: Address): BattleStateEntry[] {
    return this.listBattles({ agent, arena }).filter(
      (e) => e.phase === 'open' || e.phase === 'committed' || e.phase === 'active'
    );
  }

  /** Remove a battle entry (after settlement or cancellation) */
  removeBattle(battleId: Hex): void {
    delete this.state.battles[battleId];
    this.save();
  }

  /** Remove all settled/cancelled battles (cleanup) */
  pruneCompleted(): number {
    let pruned = 0;
    for (const [id, entry] of Object.entries(this.state.battles)) {
      if (entry.phase === 'settled' || entry.phase === 'cancelled') {
        delete this.state.battles[id];
        pruned++;
      }
    }
    if (pruned > 0) this.save();
    return pruned;
  }

  /** Get the file path being used */
  getFilePath(): string {
    return this.filePath;
  }

  /** Get the raw state (for testing) */
  getState(): BattleStateFile {
    return this.state;
  }
}
