// ArenaFighter — TypeScript SDK for interacting with ClawttackArena on Base
//
// Usage:
//   const fighter = new ArenaFighter({ walletClient, publicClient, contractAddress });
//   const { battleId, seed } = await fighter.createChallenge({ stake: parseEther('0.001') });
//   await fighter.acceptChallenge({ battleId, stake: parseEther('0.001') });
//   await fighter.revealSeeds({ battleId, seedA, seedB });
//   const word = await fighter.getChallengeWord(battleId, 1);
//   await fighter.submitTurn({ battleId, message: `My message with ${word}` });

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  keccak256,
  encodePacked,
  parseEther,
} from 'viem';

// --- ABI (minimal, only the functions we call) ---

export const ARENA_ABI = [
  {
    name: 'createChallenge',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commitA', type: 'bytes32' },
      { name: 'maxTurns', type: 'uint8' },
      { name: 'baseTimeout', type: 'uint64' },
    ],
    outputs: [{ name: 'battleId', type: 'bytes32' }],
  },
  {
    name: 'acceptChallenge',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'battleId', type: 'bytes32' },
      { name: 'commitB', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'revealSeeds',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'bytes32' },
      { name: 'seedA', type: 'string' },
      { name: 'seedB', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'submitTurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'bytes32' },
      { name: 'message', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'claimTimeout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'cancelChallenge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'reclaimExpired',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'reclaimCommitted',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getChallengeWord',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'battleId', type: 'bytes32' },
      { name: 'turnNumber', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'getBattleCore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [
      { name: '_challenger', type: 'address' },
      { name: '_opponent', type: 'address' },
      { name: '_stake', type: 'uint256' },
      { name: '_phase', type: 'uint8' },
      { name: '_currentTurn', type: 'uint8' },
      { name: '_maxTurns', type: 'uint8' },
      { name: '_winner', type: 'address' },
    ],
  },
  {
    name: 'getBattleTiming',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [
      { name: '_turnDeadline', type: 'uint64' },
      { name: '_baseTimeout', type: 'uint64' },
      { name: '_createdAt', type: 'uint64' },
      { name: '_settledAt', type: 'uint64' },
    ],
  },
  {
    name: 'whoseTurn',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'timeRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'battleId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    name: 'agents',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'elo', type: 'uint32' },
      { name: 'wins', type: 'uint32' },
      { name: 'losses', type: 'uint32' },
      { name: 'draws', type: 'uint32' },
    ],
  },
  // Events
  {
    name: 'ChallengeCreated',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'challenger', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'commitA', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'ChallengeAccepted',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'opponent', type: 'address', indexed: true },
      { name: 'commitB', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'SeedsRevealed',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'firstWord', type: 'string', indexed: false },
    ],
  },
  {
    name: 'TurnSubmitted',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'turnNumber', type: 'uint8', indexed: false },
      { name: 'message', type: 'string', indexed: false },
      { name: 'wordFound', type: 'bool', indexed: false },
    ],
  },
  {
    name: 'BattleSettled',
    type: 'event',
    inputs: [
      { name: 'battleId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'finalTurn', type: 'uint8', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const;

// --- Types ---

/** Known contract revert reasons */
export type ArenaRevertReason =
  | 'InvalidPhase'
  | 'NotYourTurn'
  | 'NotParticipant'
  | 'DeadlineExpired'
  | 'DeadlineNotExpired'
  | 'InsufficientStake'
  | 'ChallengeNotExpired'
  | 'InvalidSeed'
  | 'BattleExists'
  | 'Unknown';

export class ArenaError extends Error {
  readonly reason: ArenaRevertReason;
  readonly originalError: unknown;

  constructor(reason: ArenaRevertReason, message: string, originalError?: unknown) {
    super(message);
    this.name = 'ArenaError';
    this.reason = reason;
    this.originalError = originalError;
  }
}

/** Parse viem contract revert errors into typed ArenaError */
function parseRevertError(err: unknown): ArenaError {
  const msg = err instanceof Error ? err.message : String(err);
  const reasons: ArenaRevertReason[] = [
    'InvalidPhase', 'NotYourTurn', 'NotParticipant', 'DeadlineExpired',
    'DeadlineNotExpired', 'InsufficientStake', 'ChallengeNotExpired',
    'InvalidSeed', 'BattleExists',
  ];
  for (const reason of reasons) {
    if (msg.includes(reason)) {
      return new ArenaError(reason, `Arena contract reverted: ${reason}`, err);
    }
  }
  return new ArenaError('Unknown', `Arena contract error: ${msg}`, err);
}

export enum BattlePhase {
  Open = 0,
  Committed = 1,
  Active = 2,
  Settled = 3,
  Cancelled = 4,
}

export interface BattleCore {
  challenger: Address;
  opponent: Address;
  stake: bigint;
  phase: BattlePhase;
  currentTurn: number;
  maxTurns: number;
  winner: Address;
}

export interface BattleTiming {
  turnDeadline: bigint;
  baseTimeout: bigint;
  createdAt: bigint;
  settledAt: bigint;
}

export interface AgentStats {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface ArenaFighterConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  contractAddress: Address;
}

export interface CreateChallengeOptions {
  stake?: bigint;
  maxTurns?: number;
  baseTimeout?: number;
  seed?: string;
}

export interface CreateChallengeResult {
  battleId: Hex;
  seed: string;
  commit: Hex;
  txHash: Hex;
}

export interface AcceptChallengeResult {
  seed: string;
  commit: Hex;
  txHash: Hex;
}

// --- ArenaFighter Class ---

export class ArenaFighter {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private contractAddress: Address;

  constructor(config: ArenaFighterConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.contractAddress = config.contractAddress;
  }

  // --- Seed Helpers ---

  /** Generate a random seed string */
  static generateSeed(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Compute the keccak256 commitment for a seed */
  static commitSeed(seed: string): Hex {
    return keccak256(encodePacked(['string'], [seed]));
  }

  // --- Write Functions ---

  /**
   * Create an open challenge. Returns battleId and the seed.
   *
   * ⚠️ SECURITY: The returned `seed` is SECRET until revealSeeds() is called.
   * Do NOT log, serialize to disk, or transmit it. Store in memory only.
   * If the seed leaks, opponents can precompute all challenge words.
   */
  async createChallenge(opts: CreateChallengeOptions = {}): Promise<CreateChallengeResult> {
    const seed = opts.seed ?? ArenaFighter.generateSeed();
    const commit = ArenaFighter.commitSeed(seed);
    const stake = opts.stake ?? 0n;
    const maxTurns = opts.maxTurns ?? 0;
    const baseTimeout = opts.baseTimeout ?? 0;

    let txHash: Hex;
    try {
      txHash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'createChallenge',
        args: [commit, maxTurns, BigInt(baseTimeout)],
        value: stake,
      });
    } catch (err) {
      throw parseRevertError(err);
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    // Extract battleId from ChallengeCreated event
    const log = receipt.logs.find(
      (l) => l.address.toLowerCase() === this.contractAddress.toLowerCase()
    );
    const battleId = log?.topics[1] as Hex;

    if (!battleId) {
      throw new Error('Failed to extract battleId from ChallengeCreated event');
    }

    return { battleId, seed, commit, txHash };
  }

  /**
   * Accept an open challenge. Matches the stake.
   *
   * ⚠️ SECURITY: The returned `seed` is SECRET until revealSeeds() is called.
   * Do NOT log, serialize to disk, or transmit it.
   */
  async acceptChallenge(
    battleId: Hex,
    stake: bigint,
    seed?: string
  ): Promise<AcceptChallengeResult> {
    const actualSeed = seed ?? ArenaFighter.generateSeed();
    const commit = ArenaFighter.commitSeed(actualSeed);

    let txHash: Hex;
    try {
      txHash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'acceptChallenge',
        args: [battleId, commit],
        value: stake,
      });
    } catch (err) {
      throw parseRevertError(err);
    }

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    return { seed: actualSeed, commit, txHash };
  }

  /** Reveal both seeds to start the battle. Either participant can call. */
  async revealSeeds(battleId: Hex, seedA: string, seedB: string): Promise<Hex> {
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'revealSeeds',
        args: [battleId, seedA, seedB],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /** Submit a turn message. Must contain the challenge word for your turn. */
  async submitTurn(battleId: Hex, message: string): Promise<Hex> {
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'submitTurn',
        args: [battleId, message],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /** Claim timeout if opponent didn't submit in time. */
  async claimTimeout(battleId: Hex): Promise<Hex> {
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'claimTimeout',
        args: [battleId],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /** Cancel an open (unaccepted) challenge. */
  async cancelChallenge(battleId: Hex): Promise<Hex> {
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'cancelChallenge',
        args: [battleId],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  // --- Read Functions ---

  /** Get the challenge word for a specific turn. */
  async getChallengeWord(battleId: Hex, turnNumber: number): Promise<string> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'getChallengeWord',
      args: [battleId, turnNumber],
    }) as Promise<string>;
  }

  /** Get battle core state. */
  async getBattleCore(battleId: Hex): Promise<BattleCore> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'getBattleCore',
      args: [battleId],
    })) as [Address, Address, bigint, number, number, number, Address];

    return {
      challenger: result[0],
      opponent: result[1],
      stake: result[2],
      phase: result[3] as BattlePhase,
      currentTurn: result[4],
      maxTurns: result[5],
      winner: result[6],
    };
  }

  /** Get battle timing info. */
  async getBattleTiming(battleId: Hex): Promise<BattleTiming> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'getBattleTiming',
      args: [battleId],
    })) as [bigint, bigint, bigint, bigint];

    return {
      turnDeadline: result[0],
      baseTimeout: result[1],
      createdAt: result[2],
      settledAt: result[3],
    };
  }

  /** Check whose turn it is. */
  async whoseTurn(battleId: Hex): Promise<Address> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'whoseTurn',
      args: [battleId],
    }) as Promise<Address>;
  }

  /** Get time remaining for current turn. */
  async timeRemaining(battleId: Hex): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'timeRemaining',
      args: [battleId],
    }) as Promise<bigint>;
  }

  /** Get agent stats (Elo, wins, losses, draws). */
  async getAgentStats(agent: Address): Promise<AgentStats> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'agents',
      args: [agent],
    })) as [number, number, number, number];

    return {
      elo: result[0],
      wins: result[1],
      losses: result[2],
      draws: result[3],
    };
  }

  /** Check if it's our turn. */
  async isMyTurn(battleId: Hex): Promise<boolean> {
    const [account] = await this.walletClient.getAddresses();
    const current = await this.whoseTurn(battleId);
    return current.toLowerCase() === account.toLowerCase();
  }
}
