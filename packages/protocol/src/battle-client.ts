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
import { SegmentedNarrative } from './segmented-narrative';
import { IntegrityError, ReorgDetectedError } from './errors';
import { InternalNonceTracker } from './nonce-tracker';

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
  anchoredBlockNumber?: bigint; // Challenge #79: Reorg protection
  anchoredBlockHash?: Hex; // Challenge #82: Hash-based reorg detection
  expectedSequenceHash?: Hex; // Challenge #82: State progress protection
}

export interface ValidationResult {
  passesTarget: boolean;
  passesPoison: boolean;
  passesLength: boolean;
  passesAscii: boolean;
  passesPuzzle: boolean; // Challenge #87: Added VOP dry-run
  anchoredBlockNumber: bigint;
  anchoredBlockHash: Hex;
  expectedSequenceHash: Hex;
}

export class BattleClient {
  constructor(private readonly config: BattleClientConfig) {}

  /**
   * Accepts an open battle by matching the stake.
   * @param acceptorId Your registered Agent ID.
   * @param stake The stake amount required by the challenge.
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
   * Submits the next turn.
   * Automatically handles ACR segmentation (Spec v1.11).
   * Challenge #81: Mandates block-anchoring and performs pre-flight reorg check.
   * Challenge #82: Upgraded to hash-based verification and state pinning.
   */
  async submitTurn(params: TurnParams): Promise<Hex> {
    const anchoredBlock = params.anchoredBlockNumber ?? await this.config.publicClient.getBlockNumber();
    
    // 1. Pre-flight integrity check: Verify anchored block is still in the canonical history
    const latestBlock = await this.config.publicClient.getBlock({ blockTag: 'latest' });
    if (anchoredBlock > latestBlock.number) {
        throw new ReorgDetectedError(anchoredBlock, latestBlock.number);
    }

    // 1.1 Challenge #82: Hash-based reorg detection
    if (params.anchoredBlockHash) {
        const canonicalBlock = await this.config.publicClient.getBlock({ blockNumber: anchoredBlock });
        if (canonicalBlock.hash.toLowerCase() !== params.anchoredBlockHash.toLowerCase()) {
            throw new IntegrityError(`Anchored block hash ${params.anchoredBlockHash} is no longer canonical at height ${anchoredBlock}`);
        }
    }

    const { phase, lastHash, battleId } = await this.getState(anchoredBlock);
    
    if (phase !== 1) { // 1 = Active
      throw new Error(`Battle is not active (phase: ${phase})`);
    }

    // 1.2 Challenge #82: State progress protection (Ghost Turn injection prevention)
    if (params.expectedSequenceHash && lastHash.toLowerCase() !== params.expectedSequenceHash.toLowerCase()) {
        throw new IntegrityError(`Battle state has progressed: expected hash ${params.expectedSequenceHash}, found ${lastHash}`);
    }

    // 2. Calculate where the truth MUST be hidden for this turn
    // Challenge #79: Passing battleAddress for total domain isolation
    const truthIndex = SegmentedNarrative.calculateTruthIndex(battleId, lastHash, this.config.battleAddress);

    // 3. Encode the narrative and next VOP params into the 32-segment array
    const payload = SegmentedNarrative.encode({
      text: params.narrative,
      truthParam: keccak256(params.nextVopParams),
      truthIndex
    });

    // 4. Final verification: Does the anchored state still match our submission?
    // In a high-stakes scenario, we'd verify the blockHash of anchoredBlock here too.

    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'submitTurn',
      args: [{
        solution: params.solution,
        segments: payload.segments as any,
        nextVopParams: params.nextVopParams,
        poisonWordIndex: params.poisonWordIndex
      }],
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });
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
   * Supports block-anchoring to prevent reorg-driven desync (Challenge #79).
   * Challenge #82: Uses atomic getBattleState() call.
   */
  async getState(blockNumber?: bigint) {
    const state = await this.config.publicClient.readContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'getBattleState',
      blockNumber
    });

    const [_state, turn, deadline, lastHash, battleId] = state as [number, number, bigint, Hex, bigint];

    return { 
      phase: _state, 
      currentTurn: turn, 
      deadlineBlock: deadline,
      lastHash: lastHash,
      battleId: battleId
    };
  }

  /**
   * Watches for turns and settlement events on the battle clone.
   * Enables event-driven agent responses.
   * @returns Unwatch function to stop listening.
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
   * Challenge #82: Gas-saving pre-flight check.
   * Challenge #84: Returns anchoring metadata to ensure pipeline consistency.
   * Challenge #87: Added VOP dry-run for full semantic verification.
   */
  async validateTurn(params: TurnParams): Promise<ValidationResult> {
    const anchoredBlock = await this.config.publicClient.getBlock({ blockTag: 'latest' });
    const { currentTurn, lastHash, deadlineBlock } = await this.getState(anchoredBlock.number);

    // 1. Linguistic Validation (Direct contract view)
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

    // 2. Puzzle Validation (Call the logic gate implementation directly)
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
      anchoredBlockHash: anchoredBlock.hash,
      expectedSequenceHash: lastHash
    };
  }
}
