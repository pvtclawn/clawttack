import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient,
  decodeEventLog
} from 'viem';
import { CLAWTTACK_BATTLE_ABI, IVERIFIABLE_ORACLE_PRIMITIVE_ABI } from './abi';
import { IntegrityError, ReorgDetectedError } from './errors';
import { InternalNonceTracker } from './nonce-tracker';

export interface BattleClientConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  battleAddress: Address;
}

export interface TurnParams {
  solution: bigint;
  customPoisonWord: string;
  narrative: string;
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
  async acceptBattle(acceptorId: bigint, stake: bigint, secretHash: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'): Promise<Hex> {
    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'acceptBattle',
      args: [acceptorId, secretHash],
      value: stake,
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });
  }

  /**
   * Submits the next turn with narrative and puzzle solution.
   * Performs pre-flight reorg and state integrity checks.
   */
  async submitTurn(params: TurnParams): Promise<Hex> {
    const anchoredBlock = params.anchoredBlockNumber ?? await this.config.publicClient.getBlockNumber();
    
    // Pre-flight: verify anchored block is in canonical chain
    const latestBlock = await this.config.publicClient.getBlock({ blockTag: 'latest' });
    if (anchoredBlock > latestBlock.number) {
      throw new ReorgDetectedError(anchoredBlock, latestBlock.number);
    }

    // Hash-based reorg detection
    if (params.anchoredBlockHash) {
      const canonicalBlock = await this.config.publicClient.getBlock({ blockNumber: anchoredBlock });
      if (canonicalBlock.hash.toLowerCase() !== params.anchoredBlockHash.toLowerCase()) {
        throw new IntegrityError(`Block hash mismatch at height ${anchoredBlock}`);
      }
    }

    const { phase, lastHash } = await this.getState(anchoredBlock);
    
    if (phase !== 1) {
      throw new Error(`Battle is not active (phase: ${phase})`);
    }

    // State progress protection
    if (params.expectedSequenceHash && lastHash.toLowerCase() !== params.expectedSequenceHash.toLowerCase()) {
      throw new IntegrityError(`State progressed: expected ${params.expectedSequenceHash}, got ${lastHash}`);
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
        customPoisonWord: params.customPoisonWord,
        narrative: params.narrative
      }],
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
      nonce
    });

    // Mempool echo for nonce recovery
    InternalNonceTracker.getInstance().verifyEcho(
      this.config.walletClient.account!.address,
      txHash,
      this.config.publicClient
    ).catch(() => {});

    return txHash;
  }

  /**
   * Claims victory if the opponent missed their turn deadline.
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
   * Submits a captured signature to prove system compromise (ECDSA CTF).
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
   * Captures the opponent's flag by revealing their secret string (String CTF).
   */
  async captureFlag(secret: string): Promise<Hex> {
    const nonce = await InternalNonceTracker.getInstance().getNextNonce(
      this.config.walletClient.account!.address, 
      this.config.publicClient
    );

    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'captureFlag',
      args: [secret],
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
   * Returns battle state. Supports block-anchoring for reorg protection.
   */
  async getState(blockNumber?: bigint) {
    // Uses getBattleState() atomic getter (Challenge #82) — single RPC call
    const result = await this.config.publicClient.readContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'getBattleState',
      blockNumber
    }) as [number, number, bigint, Hex, bigint, boolean];

    return { 
      phase: Number(result[0]), 
      currentTurn: Number(result[1]), 
      deadlineBlock: result[2],
      lastHash: result[3],
      battleId: result[4],
      firstMoverA: result[5]
    };
  }

  /**
   * Watches for turn and settlement events on the battle clone.
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
   * Returns whose turn it is (address).
   */
  async whoseTurn(): Promise<Address> {
    const { phase, currentTurn, firstMoverA } = await this.getState();
    if (phase !== 1) return '0x0000000000000000000000000000000000000000';

    const [ownerA, ownerB] = await Promise.all([
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
   * Pre-flight validation: checks narrative linguistics and VOP puzzle solution.
   * Returns anchoring metadata for pipeline consistency with submitTurn().
   */
  async validateTurn(params: TurnParams): Promise<ValidationResult> {
    const anchoredBlock = await this.config.publicClient.getBlock({ blockTag: 'latest' });
    const { currentTurn, lastHash, deadlineBlock } = await this.getState(anchoredBlock.number);

    // 1. Linguistic validation
    const [targetIdx, currentPoison] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'targetWordIndex',
        blockNumber: anchoredBlock.number
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'poisonWord',
        blockNumber: anchoredBlock.number
      })
    ]);

    const wouldPass = await this.config.publicClient.readContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'wouldNarrativePass',
      args: [
        params.narrative,
        targetIdx as number,
        currentPoison as string, 
        currentTurn === 0
      ],
      blockNumber: anchoredBlock.number
    });

    const [passesTarget, passesPoison, passesLength, passesAscii] = wouldPass as [boolean, boolean, boolean, boolean];

    // 2. VOP puzzle dry-run
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
