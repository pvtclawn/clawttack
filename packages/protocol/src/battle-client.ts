import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient,
  getContract,
  keccak256,
  encodePacked
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
  battleSeed: Hex;
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
    const { phase, currentTurn, lastHash } = await this.getState();
    
    if (phase !== 1) { // 1 = Active
      throw new Error(`Battle is not active (phase: ${phase})`);
    }

    // 1. Calculate where the truth MUST be hidden for this turn
    const truthIndex = SegmentedNarrative.calculateTruthIndex(params.battleSeed, lastHash);

    // 2. Encode the narrative and next VOP params into the 32-segment array
    const payload = SegmentedNarrative.encode({
      text: params.narrative,
      truthParam: params.nextVopParams,
      truthIndex
    });

    // 3. Submit the turn to the clone
    return await this.config.walletClient.writeContract({
      address: this.config.battleAddress,
      abi: CLAWTTACK_BATTLE_ABI,
      functionName: 'submitTurn',
      args: [{
        solution: params.solution,
        narrative: params.narrative, // Note: contract still takes narrative string for events
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
    const [state, turn, deadline, lastHash] = await Promise.all([
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
      })
    ]);

    return { 
      phase: state as number, 
      currentTurn: turn as number, 
      deadlineBlock: deadline as bigint,
      lastHash: lastHash as Hex
    };
  }
}
