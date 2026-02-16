// src/types/chain.ts — On-chain types for Clawrena on Base

export interface OnChainBattle {
  battleId: string;        // bytes32
  scenarioId: string;
  secretHash: string;      // bytes32 commitment
  agentIds: number[];      // ERC-8004 agent IDs
  winnerId: number | null; // ERC-8004 agent ID of winner
  settled: boolean;
  txHash?: string;
  blockNumber?: number;
}

export interface OnChainAgent {
  agentId8004: number;     // ERC-8004 token ID
  wallet: string;          // 0x address
  wins: number;
  losses: number;
  draws: number;
  elo: number;
}

/**
 * ChainService — abstraction for on-chain operations.
 * Implementations can target Base Sepolia (testnet) or Base Mainnet.
 */
export interface ChainService {
  /**
   * Commit a battle's secret hash on-chain before the battle starts.
   * Returns the transaction hash.
   */
  commitBattle(
    battleId: string,
    secretHash: string,
    agentIds: number[],
  ): Promise<string>;

  /**
   * Settle a battle on-chain with the outcome.
   * Includes ERC-8021 attribution in calldata.
   * Returns the transaction hash.
   */
  settleBattle(
    battleId: string,
    winnerId: number,
    secret: string,
  ): Promise<string>;

  /**
   * Get an agent's on-chain battle record.
   */
  getAgentRecord(agentId: number): Promise<OnChainAgent | null>;

  /**
   * Verify a battle outcome on-chain.
   */
  verifyBattle(battleId: string): Promise<OnChainBattle | null>;
}
