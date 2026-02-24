import { type PublicClient, type Hex, type Address, decodeFunctionData, keccak256, encodePacked } from 'viem';
import { ARENA_ABI } from './arena-fighter';

export interface PendingTurn {
  battleId: Hex;
  agent: Address;
  message: string;
  txHash: Hex;
}

/**
 * MempoolWatcher — Monitors Base mempool for Arena turn submissions.
 * Used to verify Waku "fast-path" broadcasts against actual on-chain commitments.
 */
export class MempoolWatcher {
  private publicClient: PublicClient;
  private contractAddress: Address;
  private unwatch?: () => void;
  private pendingTurns: Map<Hex, PendingTurn> = new Map();

  constructor(publicClient: PublicClient, contractAddress: Address) {
    this.publicClient = publicClient;
    this.contractAddress = contractAddress;
  }

  /**
   * Start watching for pending submitTurn transactions.
   */
  async start() {
    if (this.unwatch) return;

    this.unwatch = await this.publicClient.watchPendingTransactions({
      onTransactions: async (hashes) => {
        for (const hash of hashes) {
          try {
            const tx = await this.publicClient.getTransaction({ hash });
            
            // Only care about transactions to our Arena contract
            if (tx.to?.toLowerCase() !== this.contractAddress.toLowerCase()) continue;

            // Decode calldata
            const decoded = decodeFunctionData({
              abi: ARENA_ABI,
              data: tx.input,
            });

            if (decoded.functionName === 'submitTurn') {
              const [payload] = decoded.args as [{ solution: bigint; customPoisonWord: string; narrative: string }];
              
              const turn: PendingTurn = {
                battleId: tx.to as Hex, // In v3, submitTurn is called on the battle clone
                agent: tx.from,
                message: payload.narrative,
                txHash: hash,
              };

              // Store in local cache for verification
              const key = keccak256(encodePacked(['address', 'string'], [turn.battleId as `0x${string}`, payload.narrative]));
              this.pendingTurns.set(key, turn);
              
              // Cleanup after 5 minutes to prevent memory leak
              setTimeout(() => this.pendingTurns.delete(key), 300_000);
            }
          } catch {
            // Transaction might be dropped or internal error, ignore
          }
        }
      },
    });
  }

  /**
   * Stop watching the mempool.
   */
  stop() {
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = undefined;
    }
  }

  /**
   * Verify if a Waku message has a matching pending transaction on Base.
   */
  isVerified(battleId: Hex, message: string): Hex | undefined {
    const key = keccak256(encodePacked(['bytes32', 'string'], [battleId, message]));
    return this.pendingTurns.get(key)?.txHash;
  }
}
