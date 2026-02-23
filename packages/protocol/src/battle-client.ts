import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient,
  getContract,
  keccak256,
  encodePacked,
  decodeEventLog
} from 'viem';
import { CLAWTTACK_BATTLE_ABI, IVERIFIABLE_ORACLE_PRIMITIVE_ABI } from './abi';
import { IntegrityError, ReorgDetectedError } from './errors';
import { InternalNonceTracker } from './nonce-tracker';
import { Epoch } from './epoch';

export interface BattleClientConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  battleAddress: Address;
}

export interface TurnParams {
  solution: bigint;
  narrative: string;
  nextVopParams: Hex;
  poisonWordIndex: number;
  /** Optional: pipe from Epoch.toAnchor() for reorg protection */
  anchoredBlockNumber?: bigint;
  anchoredBlockHash?: Hex;
  expectedSequenceHash?: Hex;
}

export interface ValidationResult {
  passesTarget: boolean;
  passesPoison: boolean;
  passesLength: boolean;
  passesAscii: boolean;
  passesPuzzle: boolean;
  anchoredBlockNumber: bigint;
  anchoredBlockHash: Hex;
  expectedSequenceHash: Hex;
}

export class BattleClient {
  constructor(private readonly config: BattleClientConfig) {}

  /**
   * Accepts an open battle by matching the stake.
   */
  async acceptBattle(acceptorId: bigint, stake: bigint): Promise<Hex> {
    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'acceptBattle',
      args: [acceptorId],
      value: stake,
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });
  }

  /**
   * Submits the next turn with a plain narrative string.
   * Performs optional reorg pre-flight checks if anchoring data is provided.
   */
  async submitTurn(params: TurnParams): Promise<Hex> {
    // Pre-flight reorg check if anchoring is provided
    if (params.anchoredBlockNumber) {
      const latestBlock = await this.config.publicClient.getBlock({ blockTag: 'latest' });
      if (params.anchoredBlockNumber > latestBlock.number) {
        throw new ReorgDetectedError(params.anchoredBlockNumber, latestBlock.number);
      }

      if (params.anchoredBlockHash) {
        const canonicalBlock = await this.config.publicClient.getBlock({ 
          blockNumber: params.anchoredBlockNumber 
        });
        if (canonicalBlock.hash!.toLowerCase() !== params.anchoredBlockHash.toLowerCase()) {
          throw new IntegrityError(
            `Anchored block hash ${params.anchoredBlockHash} is no longer canonical at height ${params.anchoredBlockNumber}`
          );
        }
      }
    }

    const blockNumber = params.anchoredBlockNumber ?? await this.config.publicClient.getBlockNumber();
    const { phase, lastHash } = await this.getState(blockNumber);
    
    if (phase !== 1) { // 1 = Active
      throw new Error(`Battle is not active (phase: ${phase})`);
    }

    // State progress protection
    if (params.expectedSequenceHash && lastHash.toLowerCase() !== params.expectedSequenceHash.toLowerCase()) {
      throw new IntegrityError(
        `Battle state has progressed: expected hash ${params.expectedSequenceHash}, found ${lastHash}`
      );
    }

    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    const txHash = await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'submitTurn',
      args: [{
        solution: params.solution,
        narrative: params.narrative,
        nextVopParams: params.nextVopParams,
        poisonWordIndex: params.poisonWordIndex
      }],
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });

    // Mempool Echo for Nonce Recovery
    InternalNonceTracker.getInstance().verifyEcho(
      this.config.walletClient.account!.address,
      txHash,
      this.config.publicClient
    ).catch(() => {});

    return txHash;
  }

  /**
   * Claims victory if the active opponent has missed their turn deadline.
   */
  async claimTimeoutWin(): Promise<Hex> {
    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'claimTimeoutWin',
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });
  }

  /**
   * Submits a captured signature to prove system compromise (CTF).
   */
  async submitCompromise(signature: Hex): Promise<Hex> {
    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'submitCompromise',
      args: [signature],
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });
  }

  /**
   * Cancels an unaccepted battle (challenger only).
   */
  async cancelBattle(): Promise<Hex> {
    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'cancelBattle',
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });
  }

  /**
   * Helper to check current state.
   * Supports block-anchoring for reorg protection.
   */
  async getState(blockNumber?: bigint) {
    const [_state, currentTurn, deadline, seqHash, bId, challengerId, acceptorId] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'state',
        blockNumber
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'currentTurn',
        blockNumber
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'turnDeadlineBlock',
        blockNumber
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'sequenceHash',
        blockNumber
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'battleId',
        blockNumber
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'challengerId',
        blockNumber
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'acceptorId',
        blockNumber
      }),
    ]);

    return { 
      phase: _state as number, 
      currentTurn: currentTurn as number, 
      deadlineBlock: deadline as bigint,
      lastHash: seqHash as Hex,
      battleId: bId as bigint,
      challengerId: challengerId as bigint,
      acceptorId: acceptorId as bigint
    };
  }

  /**
   * Watches for turns and settlement events on the battle clone.
   */
  watch(callbacks: {
    onTurn?: (event: { turnNumber: number; playerId: bigint; narrative: string }) => void;
    onSettled?: (event: { winnerId: bigint; loserId: bigint; resultType: number }) => void;
  }) {
    const unwatchTurn = this.config.publicClient.watchContractEvent({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      eventName: 'TurnSubmitted',
      onLogs: (logs) => {
        for (const log of logs) {
          const { turnNumber, playerId, narrative } = (log as any).args;
          callbacks.onTurn?.({ turnNumber, playerId, narrative });
        }
      }
    });

    const unwatchSettled = this.config.publicClient.watchContractEvent({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      eventName: 'BattleSettled',
      onLogs: (logs) => {
        for (const log of logs) {
          const { winnerId, loserId, resultType } = (log as any).args;
          callbacks.onSettled?.({ winnerId, loserId, resultType });
        }
      }
    });

    return () => {
      unwatchTurn();
      unwatchSettled();
    };
  }

  /**
   * Helper to check whose turn it is.
   */
  async whoseTurn(): Promise<Address> {
    const { phase, currentTurn } = await this.getState();
    if (phase !== 1) return '0x0000000000000000000000000000000000000000';

    const [firstMoverA, ownerA, ownerB] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'firstMoverA',
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'challengerOwner',
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'acceptorOwner',
      })
    ]);

    const expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;
    
    return (expectedA ? ownerA : ownerB) as Address;
  }

  /**
   * Dry-runs a turn against the contract's linguistic and VOP logic.
   * Returns anchoring metadata for pipeline consistency.
   */
  async validateTurn(params: TurnParams): Promise<ValidationResult> {
    const anchoredBlock = await this.config.publicClient.getBlock({ blockTag: 'latest' });
    const { currentTurn, lastHash, deadlineBlock } = await this.getState(anchoredBlock.number);

    // 1. Linguistic Validation
    const wouldPass = await this.config.publicClient.readContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'wouldNarrativePass',
      args: [
        params.narrative,
        0, // targetIdx placeholder
        params.poisonWordIndex, 
        currentTurn === 0
      ],
      blockNumber: anchoredBlock.number
    });

    const [passesTarget, passesPoison, passesLength, passesAscii] = wouldPass as [boolean, boolean, boolean, boolean];

    // 2. Puzzle Validation
    const [currentVop, currentVopParams] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'currentVop',
        blockNumber: anchoredBlock.number
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'currentVopParams',
        blockNumber: anchoredBlock.number
      })
    ]);

    const passesPuzzle = await this.config.publicClient.readContract({
      address: currentVop as Address,
      abi: IVERIFIABLE_ORACLE_PRIMITIVE_ABI,
      functionName: 'verify',
      args: [currentVopParams as Hex, params.solution, deadlineBlock],
      blockNumber: anchoredBlock.number
    }) as boolean;
    
    return { 
      passesTarget, 
      passesPoison, 
      passesLength, 
      passesAscii,
      passesPuzzle,
      anchoredBlockNumber: anchoredBlock.number,
      anchoredBlockHash: anchoredBlock.hash as Hex,
      expectedSequenceHash: lastHash
    };
  }
}
