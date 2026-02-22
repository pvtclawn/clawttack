import { type Address, type PublicClient } from 'viem';

/**
 * Address-scoped internal nonce tracker.
 * Challenge #83: Prevents sequential turn failures due to RPC pending nonce lag.
 */
export class InternalNonceTracker {
  private static instance: InternalNonceTracker;
  private nonces: Map<Address, number> = new Map();

  private constructor() {}

  static getInstance(): InternalNonceTracker {
    if (!InternalNonceTracker.instance) {
      InternalNonceTracker.instance = new InternalNonceTracker();
    }
    return InternalNonceTracker.instance;
  }

  /**
   * Returns the next nonce for the given address.
   * Tracks max(RPC_Nonce, last_sent_nonce + 1).
   */
  async getNextNonce(address: Address, publicClient: PublicClient): Promise<number> {
    const rpcNonce = await publicClient.getTransactionCount({ 
      address, 
      blockTag: 'pending' 
    });
    
    const lastNonce = this.nonces.get(address) ?? -1;
    const nextNonce = Math.max(rpcNonce, lastNonce + 1);
    
    this.nonces.set(address, nextNonce);
    return nextNonce;
  }

  /**
   * Manually sets the nonce for an address.
   * Used for recovery or explicit synchronization.
   */
  setNonce(address: Address, nonce: number) {
    this.nonces.set(address, nonce);
  }

  /**
   * Resets the internal counter for an address, forcing a re-sync with RPC.
   */
  reset(address: Address) {
    this.nonces.delete(address);
  }
}
