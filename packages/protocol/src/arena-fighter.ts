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
  parseAbiItem,
} from 'viem';
import { MempoolWatcher } from './mempool';

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
    name: 'revealSeed',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'battleId', type: 'bytes32' },
      { name: 'seed', type: 'string' },
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
  mempoolWatcher?: MempoolWatcher;
  /** Number of block confirmations to wait for before submitting a turn. Default: 1 */
  finalityDepth?: number;
  /** Block number the Arena contract was deployed at. Used for event queries. Default: 0 */
  deployBlock?: bigint;
  deployBlock?: bigint;
  /**
   * Optional callback invoked after a turn is confirmed on-chain.
   * Use to broadcast turn data to Waku, IPFS, or other real-time channels.
   */
  onTurnBroadcast?: (turn: ArenaTurnBroadcast) => void | Promise<void>;
}

/** Turn data broadcast after on-chain confirmation */
export interface ArenaTurnBroadcast {
  battleId: Hex;
  agent: Address;
  turnNumber: number;
  message: string;
  txHash: Hex;
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

// --- Strategy Types ---

/** A single turn in the battle transcript */
export interface TurnRecord {
  turnNumber: number;
  agent: Address;
  message: string;
  wordFound: boolean;
}

/** Context passed to a TurnStrategy for generating a response */
export interface TurnContext {
  battleId: Hex;
  turnNumber: number;
  challengeWord: string;
  myAddress: Address;
  opponentAddress: Address;
  /** Full ordered transcript of all previous turns */
  history: TurnRecord[];
  /** Battle metadata */
  stake: bigint;
  maxTurns: number;
}

/**
 * A strategy function that generates a turn message.
 *
 * The returned message MUST contain the challengeWord (case-insensitive)
 * or the contract will settle the battle as a loss.
 *
 * Strategies are where the real game happens:
 * - Read opponent's previous messages
 * - Craft a response that naturally embeds the challenge word
 * - Attempt to manipulate the opponent into missing their word
 * - Defend against prompt injection from opponent messages
 */
export type TurnStrategy = (ctx: TurnContext) => Promise<string>;

// --- ArenaFighter Class ---

export class ArenaFighter {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private contractAddress: Address;
  private deployBlock: bigint;
  private onTurnBroadcast?: (turn: ArenaTurnBroadcast) => void | Promise<void>;
  private mempoolWatcher?: MempoolWatcher;
  private finalityDepth: number;

  constructor(config: ArenaFighterConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.contractAddress = config.contractAddress;
    this.deployBlock = config.deployBlock ?? 0n;
    this.onTurnBroadcast = config.onTurnBroadcast;
    this.mempoolWatcher = config.mempoolWatcher;
    this.finalityDepth = config.finalityDepth ?? 1;
  }

  /** Wrapper for RPC calls with exponential backoff */
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        // Don't retry contract reverts
        if (err.message?.includes('reverted') || err.name === 'ArenaError') {
          throw err;
        }
        const delay = 1000 * Math.pow(2, i);
        console.warn(`⚠️ RPC call failed (attempt ${i + 1}/${maxRetries}): ${err.message?.slice(0, 100)}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
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
      txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'createChallenge',
        args: [commit, maxTurns, BigInt(baseTimeout)],
        value: stake,
      }));
    } catch (err) {
      throw parseRevertError(err);
    }

    const receipt = await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));

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
      txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'acceptChallenge',
        args: [battleId, commit],
        value: stake,
      }));
    } catch (err) {
      throw parseRevertError(err);
    }

    await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));

    return { seed: actualSeed, commit, txHash };
  }

  /** Reveal both seeds to start the battle. Either participant can call. */
  async revealSeeds(battleId: Hex, seedA: string, seedB: string): Promise<Hex> {
    try {
      const txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'revealSeeds',
        args: [battleId, seedA, seedB],
      }));
      await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /**
   * Reveal your own seed independently. No coordination needed.
   * When both participants have revealed, the battle starts automatically.
   */
  async revealSeed(battleId: Hex, seed: string): Promise<Hex> {
    try {
      const txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'revealSeed',
        args: [battleId, seed],
      }));
      await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /** Submit a turn message. Must contain the challenge word for your turn. */
  async submitTurn(battleId: Hex, message: string): Promise<Hex> {
    try {
      const txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'submitTurn',
        args: [battleId, message],
      }));
      await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /** Claim timeout if opponent didn't submit in time. */
  async claimTimeout(battleId: Hex): Promise<Hex> {
    try {
      const txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'claimTimeout',
        args: [battleId],
      }));
      await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  /** Cancel an open (unaccepted) challenge. */
  async cancelChallenge(battleId: Hex): Promise<Hex> {
    try {
      const txHash = await this.withRetry(() => this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ARENA_ABI,
        functionName: 'cancelChallenge',
        args: [battleId],
      }));
      await this.withRetry(() => this.publicClient.waitForTransactionReceipt({ hash: txHash }));
      return txHash;
    } catch (err) {
      throw parseRevertError(err);
    }
  }

  // --- Read Functions ---

  /** Get the challenge word for a specific turn. */
  async getChallengeWord(battleId: Hex, turnNumber: number): Promise<string> {
    return this.withRetry(() => this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'getChallengeWord',
      args: [battleId, turnNumber],
    })) as Promise<string>;
  }

  /** Get battle core state. */
  async getBattleCore(battleId: Hex): Promise<BattleCore> {
    const result = (await this.withRetry(() => this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'getBattleCore',
      args: [battleId],
    }))) as [Address, Address, bigint, number, number, number, Address];

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
    const result = (await this.withRetry(() => this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'getBattleTiming',
      args: [battleId],
    }))) as [bigint, bigint, bigint, bigint];

    return {
      turnDeadline: result[0],
      baseTimeout: result[1],
      createdAt: result[2],
      settledAt: result[3],
    };
  }

  /** Check whose turn it is. */
  async whoseTurn(battleId: Hex): Promise<Address> {
    return this.withRetry(() => this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'whoseTurn',
      args: [battleId],
    })) as Promise<Address>;
  }

  /** Get time remaining for current turn. */
  async timeRemaining(battleId: Hex): Promise<bigint> {
    return this.withRetry(() => this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'timeRemaining',
      args: [battleId],
    })) as Promise<bigint>;
  }

  /** Get agent stats (Elo, wins, losses, draws). */
  async getAgentStats(agent: Address): Promise<AgentStats> {
    const result = (await this.withRetry(() => this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARENA_ABI,
      functionName: 'agents',
      args: [agent],
    }))) as [number, number, number, number];

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

  // --- Battle History (from on-chain events) ---

  /**
   * Fetch the full turn history for a battle from TurnSubmitted events.
   * Returns turns in chronological order.
   *
   * Uses a sliding window from recent blocks to avoid RPC payload limits
   * on public endpoints. For historical battles, pass a larger deployBlock.
   */
  async getBattleHistory(battleId: Hex): Promise<TurnRecord[]> {
    // Public RPCs reject wide block ranges (413). Use deployBlock if set,
    // otherwise scan last 5000 blocks (~2.5 hours on Base).
    let fromBlock: bigint;
    if (this.deployBlock > 0n) {
      // Try chunked approach: scan from deploy block in 2000-block chunks
      const currentBlock = await this.publicClient.getBlockNumber();
      const allTurns: TurnRecord[] = [];
      let from = this.deployBlock;

      while (from <= currentBlock) {
        const to = from + 2000n > currentBlock ? currentBlock : from + 2000n;
        try {
          const logs = await this.publicClient.getLogs({
            address: this.contractAddress,
            event: parseAbiItem(
              'event TurnSubmitted(bytes32 indexed battleId, address indexed agent, uint8 turnNumber, string message, bool wordFound)'
            ),
            args: { battleId },
            fromBlock: from,
            toBlock: to,
          });
          for (const log of logs) {
            allTurns.push({
              turnNumber: log.args.turnNumber!,
              agent: log.args.agent!,
              message: log.args.message!,
              wordFound: log.args.wordFound!,
            });
          }
        } catch {
          // If chunked still fails, skip this chunk
        }
        from = to + 1n;
      }

      return allTurns.sort((a, b) => a.turnNumber - b.turnNumber);
    }

    // Fallback: recent blocks only
    const currentBlock = await this.publicClient.getBlockNumber();
    fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;

    const logs = await this.publicClient.getLogs({
      address: this.contractAddress,
      event: parseAbiItem(
        'event TurnSubmitted(bytes32 indexed battleId, address indexed agent, uint8 turnNumber, string message, bool wordFound)'
      ),
      args: { battleId },
      fromBlock,
      toBlock: 'latest',
    });

    return logs
      .map((log) => ({
        turnNumber: log.args.turnNumber!,
        agent: log.args.agent!,
        message: log.args.message!,
        wordFound: log.args.wordFound!,
      }))
      .sort((a, b) => a.turnNumber - b.turnNumber);
  }

  // --- Strategy-Driven Play ---

  /**
   * Play a turn using a strategy function.
   * Supports Spec v1.11 Tentative/Finality Split.
   *
   * 1. Fetches the challenge word for this turn
   * 2. Fetches all previous turn messages from on-chain events
   * 3. Calls the strategy to generate a response
   * 4. Validates the response contains the challenge word
   * 5. WAITS for at least 1 block confirmation of previous turn (if tentative)
   * 6. Submits the turn on-chain
   *
   * @throws if strategy returns a message without the challenge word
   * @throws ArenaError on contract revert
   */
  async playTurn(battleId: Hex, strategy: TurnStrategy, opts: { tentativeTxHash?: Hex } = {}): Promise<{ message: string; txHash: Hex }> {
    const [account] = await this.walletClient.getAddresses();
    let core = await this.getBattleCore(battleId);

    // If it's not our turn yet, check if there's a pending transaction for opponent
    if (core.phase === BattlePhase.Active) {
      const currentTurnAddress = await this.whoseTurn(battleId);
      if (currentTurnAddress.toLowerCase() !== account.toLowerCase()) {
        // Not our turn... check for tentative tx
        if (!opts.tentativeTxHash) {
          throw new ArenaError('NotYourTurn', `Not your turn (current: ${currentTurnAddress})`);
        }

        // We have a tentative hash! Wait for it to confirm before submitting,
        // but we can start reasoning now.
        console.log(`⏳ Opponent turn pending (${opts.tentativeTxHash}). Starting tentative reasoning...`);
      }
    }

    if (core.phase !== BattlePhase.Active && core.phase !== BattlePhase.Committed) {
      throw new ArenaError('InvalidPhase', `Battle is not active (phase: ${core.phase})`);
    }

    const turnNumber = core.currentTurn;
    const challengeWord = await this.getChallengeWord(battleId, turnNumber);
    const history = await this.getBattleHistory(battleId);

    const opponentAddress = core.challenger.toLowerCase() === account.toLowerCase()
      ? core.opponent
      : core.challenger;

    const ctx: TurnContext = {
      battleId,
      turnNumber,
      challengeWord,
      myAddress: account,
      opponentAddress,
      history,
      stake: core.stake,
      maxTurns: core.maxTurns,
    };

    // --- PHASE 1: REASONING (TENTATIVE) ---
    const message = await strategy(ctx);

    // Validate: strategy must include the challenge word
    if (!message.toLowerCase().includes(challengeWord.toLowerCase())) {
      throw new Error(
        `Strategy returned message without challenge word "${challengeWord}". ` +
        `This would cause a loss. Message: "${message.slice(0, 100)}..."`
      );
    }

    // --- PHASE 2: SUBMISSION (FINALIZED) ---
    
    // If we started from a tentative hash, wait for configured block confirmation
    if (opts.tentativeTxHash) {
      console.log(`⚓ Anchoring finality. Waiting for ${this.finalityDepth} confirmation(s) of ${opts.tentativeTxHash}...`);
      await this.publicClient.waitForTransactionReceipt({ 
        hash: opts.tentativeTxHash,
        confirmations: this.finalityDepth 
      });
      // Refresh state after confirmation
      core = await this.getBattleCore(battleId);
    }

    const txHash = await this.submitTurn(battleId, message);

    // Broadcast turn to real-time channels (Waku, etc.) — fire and forget
    if (this.onTurnBroadcast) {
      const [account] = await this.walletClient.getAddresses();
      Promise.resolve(this.onTurnBroadcast({
        battleId,
        agent: account,
        turnNumber,
        message,
        txHash,
      })).catch(() => {}); // don't let broadcast errors affect gameplay
    }

    return { message, txHash };
  }
}
