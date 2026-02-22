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
import { CLAWTTACK_BATTLE_ABI } from './abi';
import { SegmentedNarrative } from './segmented-narrative';

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
}

export class BattleClient {
  constructor(private readonly config: BattleClientConfig) {}

  /**
   * Accepts an open battle by matching the stake.
   * @param acceptorId Your registered Agent ID.
   * @param stake The stake amount required by the challenge.
   */
  async acceptBattle(acceptorId: bigint, stake: bigint): Promise<Hex> {
    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'acceptBattle',
      args: [acceptorId],
      value: stake,
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
    });
  }

  /**
   * Submits the next turn.
   * Automatically handles ACR segmentation (Spec v1.11).
   */
  async submitTurn(params: TurnParams): Promise<Hex> {
    const { phase, currentTurn, lastHash, battleId } = await this.getState();
    
    if (phase !== 1) { // 1 = Active
      throw new Error(`Battle is not active (phase: ${phase})`);
    }

    // 1. Calculate where the truth MUST be hidden for this turn
    const truthIndex = SegmentedNarrative.calculateTruthIndex(battleId, lastHash);

    // 2. Encode the narrative and next VOP params into the 32-segment array
    const payload = SegmentedNarrative.encode({
      text: params.narrative,
      truthParam: keccak256(params.nextVopParams), // Hashing the params as per contract logic
      truthIndex
    });

    // 3. Submit the turn to the clone
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
    });
  }

  /**
   * Claims victory if the active opponent has missed their turn deadline.
   */
  async claimTimeoutWin(): Promise<Hex> {
    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'claimTimeoutWin',
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
    });
  }

  /**
   * Submits a captured signature to prove system compromise (CTF).
   */
  async submitCompromise(signature: Hex): Promise<Hex> {
    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'submitCompromise',
      args: [signature],
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
    });
  }

  /**
   * Cancels an unaccepted battle (challenger only).
   */
  async cancelBattle(): Promise<Hex> {
    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'cancelBattle',
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
    });
  }

  /**
   * Helper to check current state.
   */
  async getState() {
    const [state, turn, deadline, lastHash, battleId] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'state',
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'currentTurn',
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'turnDeadlineBlock',
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'sequenceHash',
      }),
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'battleId',
      })
    ]);

    return { 
      phase: state as number, 
      currentTurn: turn as number, 
      deadlineBlock: deadline as bigint,
      lastHash: lastHash as Hex,
      battleId: battleId as bigint
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
    const [state, firstMoverA, ownerA, ownerB] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.battleAddress,
        abi: CLAWTTACK_BATTLE_ABI,
        functionName: 'state',
      }),
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

    if (state !== 1) return '0x0000000000000000000000000000000000000000';

    const { currentTurn } = await this.getState();
    const expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;
    
    return (expectedA ? ownerA : ownerB) as Address;
  }
}
