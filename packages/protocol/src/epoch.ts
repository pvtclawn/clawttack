// src/epoch.ts — HTN Epoch Anchoring (Subtask 11.AE)
//
// Solves Challenge #91 ("Frankenstein Reality"): When an HTN plan
// decomposes into multiple sensing subtasks, each worker may read
// chain state at a different block, causing logical drift.
//
// An Epoch captures a single canonical snapshot (block number + hash)
// and provides a frozen PublicClient wrapper that pins all reads
// to that exact height. All workers within one planning cycle share
// the same Epoch to guarantee temporal consistency.

import {
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { IntegrityError, ReorgDetectedError } from './errors';

export interface EpochSnapshot {
  /** The block number this epoch is anchored to */
  readonly blockNumber: bigint;
  /** The canonical hash at that height */
  readonly blockHash: Hex;
  /** Timestamp of the anchored block (seconds since epoch) */
  readonly timestamp: bigint;
  /** When this epoch was created (local monotonic ms) */
  readonly createdAt: number;
}

export interface EpochConfig {
  /** Maximum age in milliseconds before the epoch is considered stale (default: 12000 = ~1 Base block) */
  maxAgeMs?: number;
  /** Number of blocks behind tip to anchor (default: 0 = latest) */
  confirmations?: number;
}

const DEFAULT_MAX_AGE_MS = 12_000; // ~1 Base block
const DEFAULT_CONFIRMATIONS = 0;

/**
 * An Epoch is a frozen point-in-time view of the chain.
 *
 * Usage:
 * ```ts
 * const epoch = await Epoch.create(publicClient);
 * const state = await battleClient.getState(epoch.blockNumber);
 * const validation = await battleClient.validateTurn(params);
 * // Both reads see the exact same chain state
 * epoch.assertFresh(); // throws if too old
 * ```
 */
export class Epoch {
  private constructor(
    public readonly snapshot: EpochSnapshot,
    private readonly client: PublicClient,
    private readonly maxAgeMs: number
  ) {}

  /**
   * Creates a new Epoch anchored to the current chain tip (minus confirmations).
   */
  static async create(client: PublicClient, config?: EpochConfig): Promise<Epoch> {
    const confirmations = config?.confirmations ?? DEFAULT_CONFIRMATIONS;
    const maxAgeMs = config?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

    const latest = await client.getBlock({ blockTag: 'latest' });
    const targetNumber = latest.number - BigInt(confirmations);

    if (targetNumber < 0n) {
      throw new IntegrityError(`Cannot create epoch: confirmations (${confirmations}) exceed chain height (${latest.number})`);
    }

    // If confirmations > 0, fetch the actual confirmed block for its hash
    const targetBlock = confirmations > 0
      ? await client.getBlock({ blockNumber: targetNumber })
      : latest;

    return new Epoch(
      {
        blockNumber: targetBlock.number,
        blockHash: targetBlock.hash as Hex,
        timestamp: targetBlock.timestamp,
        createdAt: Date.now(),
      },
      client,
      maxAgeMs
    );
  }

  /** The anchored block number — pass this to all state reads */
  get blockNumber(): bigint {
    return this.snapshot.blockNumber;
  }

  /** The anchored block hash — use for reorg detection */
  get blockHash(): Hex {
    return this.snapshot.blockHash;
  }

  /** Epoch timestamp (on-chain) */
  get timestamp(): bigint {
    return this.snapshot.timestamp;
  }

  /** Age of this epoch in milliseconds (wall-clock) */
  get ageMs(): number {
    return Date.now() - this.snapshot.createdAt;
  }

  /** Whether this epoch has exceeded its max age */
  get isStale(): boolean {
    return this.ageMs > this.maxAgeMs;
  }

  /**
   * Asserts this epoch is still fresh. Throws if stale.
   * Call before committing to a transaction based on epoch-anchored reads.
   */
  assertFresh(): void {
    if (this.isStale) {
      throw new IntegrityError(
        `Epoch is stale: created ${this.ageMs}ms ago (max: ${this.maxAgeMs}ms) at block ${this.snapshot.blockNumber}`
      );
    }
  }

  /**
   * Verifies that this epoch's block is still in the canonical chain.
   * Performs a live RPC call to check the hash at our anchored height.
   * Throws ReorgDetectedError if the chain has reorganized.
   */
  async assertCanonical(): Promise<void> {
    const currentBlock = await this.client.getBlock({ blockNumber: this.snapshot.blockNumber });
    if ((currentBlock.hash as string).toLowerCase() !== (this.snapshot.blockHash as string).toLowerCase()) {
      throw new ReorgDetectedError(
        this.snapshot.blockNumber,
        this.snapshot.blockNumber,
        `Reorg detected: block ${this.snapshot.blockNumber} hash changed from ${this.snapshot.blockHash} to ${currentBlock.hash}`
      );
    }
  }

  /**
   * Combined freshness + canonicality check.
   * Use before submitting any transaction based on this epoch's data.
   */
  async assertValid(): Promise<void> {
    this.assertFresh();
    await this.assertCanonical();
  }

  /**
   * Reads a contract value pinned to this epoch's block.
   * Convenience wrapper that automatically injects blockNumber.
   */
  async readContract<T>(params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<T> {
    return await this.client.readContract({
      ...params,
      blockNumber: this.snapshot.blockNumber,
    } as any) as T;
  }

  /**
   * Creates TurnParams anchoring data from this epoch.
   * Pipe into BattleClient.submitTurn() for full pipeline consistency.
   */
  toAnchor(sequenceHash: Hex): {
    anchoredBlockNumber: bigint;
    anchoredBlockHash: Hex;
    expectedSequenceHash: Hex;
  } {
    return {
      anchoredBlockNumber: this.snapshot.blockNumber,
      anchoredBlockHash: this.snapshot.blockHash,
      expectedSequenceHash: sequenceHash,
    };
  }
}
