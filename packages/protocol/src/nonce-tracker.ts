import { type Address, type PublicClient } from 'viem';

/**
 * Address-scoped internal nonce tracker.
 * Challenge #83: Prevents sequential turn failures due to RPC pending nonce lag.
 * Challenge #84: Implements timed resync to recover from RPC dropouts (nonce gaps).
 */
export class InternalNonceTracker {
  private static instance: InternalNonceTracker;
  private nonces: Map<Address, number> = new Map();
  private lastUpdate: Map<Address, number> = new Map();
  
  /** Time in ms after which we force a re-sync with the RPC count */
  public static readonly RESYNC_THRESHOLD_MS = 60_000;

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
   * Automatically forces a re-sync if the last update was too long ago.
   */
  async getNextNonce(address: Address, publicClient: PublicClient): Promise<number> {
    const now = Date.now();
    const lastSync = this.lastUpdate.get(address) ?? 0;

    // Challenge #84: If we haven't updated in 60s, the mempool state is 
    // likely stale or we hit a nonce gap. Force a reset.
    if (now - lastSync > InternalNonceTracker.RESYNC_THRESHOLD_MS) {
      this.reset(address);
    }

    const rpcNonce = await publicClient.getTransactionCount({ 
      address, 
      blockTag: 'pending' 
    });
    
    const lastNonce = this.nonces.get(address) ?? -1;
    const nextNonce = Math.max(rpcNonce, lastNonce + 1);
    
    this.nonces.set(address, nextNonce);
    this.lastUpdate.set(address, now);
    
    return nextNonce;
  }

  /**
   * Manually sets the nonce for an address.
   * Used for recovery or explicit synchronization.
   */
  setNonce(address: Address, nonce: number) {
    this.nonces.set(address, nonce);
    this.lastUpdate.set(address, Date.now());
  }

  /**
   * Resets the internal counter for an address, forcing a re-sync with RPC.
   */
  reset(address: Address) {
    this.nonces.delete(address);
    this.lastUpdate.delete(address);
  }
}
