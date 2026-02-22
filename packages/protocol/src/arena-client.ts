import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient, 
  getContract,
  decodeEventLog
} from 'viem';
import { CLAWTTACK_ARENA_ABI } from './abi';
import { BattleClient } from './battle-client';

export interface BattleConfig {
  stake: bigint;
  maxTurns: number;
  maxJokers: number;
  baseTimeoutBlocks: number;
  warmupBlocks: number;
  targetAgentId: bigint;
}

export interface ArenaClientConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  contractAddress: Address;
}

export class ArenaClient {
  private readonly contract: any;

  constructor(private readonly config: ArenaClientConfig) {
    this.contract = getContract({
      address: config.contractAddress,
      abi: CLAWTTACK_ARENA_ABI,
      client: {
        public: config.publicClient,
        wallet: config.walletClient
      }
    });
  }

  /**
   * Registers the current wallet as an AI Agent.
   * @returns agentId derived from on-chain event.
   */
  async registerAgent(): Promise<bigint> {
    const hash = await this.config.walletClient.writeContract({
      address: this.config.contractAddress,
      abi: CLAWTTACK_ARENA_ABI,
      functionName: 'registerAgent',
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
    });

    const receipt = await this.config.publicClient.waitForTransactionReceipt({ hash });
    
    for (const log of receipt.logs) {
      try {
        const event = decodeEventLog({
          abi: CLAWTTACK_ARENA_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (event.eventName === 'AgentRegistered') {
          return (event.args as any).agentId;
        }
      } catch (e) {
        continue;
      }
    }

    throw new Error('AgentRegistered event not found in receipt');
  }

  /**
   * Retrieves the agent profile for a given ID.
   */
  async getAgentProfile(agentId: bigint) {
    const profile = await this.config.publicClient.readContract({
      address: this.config.contractAddress,
      abi: CLAWTTACK_ARENA_ABI,
      functionName: 'agents',
      args: [agentId],
    });

    const [owner, eloRating, totalWins, totalLosses] = profile as [Address, number, number, number];
    return { owner, eloRating, totalWins, totalLosses };
  }

  /**
   * Creates a new battle clone.
   */
  async createBattle(challengerId: bigint, config: BattleConfig): Promise<{
    battleId: bigint;
    battleAddress: Address;
    txHash: Hex;
  }> {
    const hash = await this.config.walletClient.writeContract({
      address: this.config.contractAddress,
      abi: CLAWTTACK_ARENA_ABI,
      functionName: 'createBattle',
      args: [challengerId, config],
      value: config.stake,
      chain: this.config.walletClient.chain,
      account: this.config.walletClient.account!,
    });

    const receipt = await this.config.publicClient.waitForTransactionReceipt({ hash });
    
    for (const log of receipt.logs) {
      try {
        const event = decodeEventLog({
          abi: CLAWTTACK_ARENA_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (event.eventName === 'BattleCreated') {
          return {
            battleId: (event.args as any).battleId,
            battleAddress: (event.args as any).battleAddress,
            txHash: hash
          };
        }
      } catch (e) {
        continue;
      }
    }

    throw new Error('BattleCreated event not found in receipt');
  }

  /**
   * Returns total counts from the factory.
   */
  async getGlobalStats() {
    const [battlesCount, agentsCount] = await Promise.all([
      this.config.publicClient.readContract({
        address: this.config.contractAddress,
        abi: CLAWTTACK_ARENA_ABI,
        functionName: 'battlesCount',
      }),
      this.config.publicClient.readContract({
        address: this.config.contractAddress,
        abi: CLAWTTACK_ARENA_ABI,
        functionName: 'agentsCount',
      })
    ]);

    return { 
      battlesCount: battlesCount as bigint, 
      agentsCount: agentsCount as bigint 
    };
  }

  /**
   * Resolve battle ID to clone address.
   */
  async getBattleAddress(battleId: bigint): Promise<Address> {
    return await this.config.publicClient.readContract({
      address: this.config.contractAddress,
      abi: CLAWTTACK_ARENA_ABI,
      functionName: 'battles',
      args: [battleId],
    }) as Address;
  }

  /**
   * Create a BattleClient instance for a specific battle.
   * Shares the same providers and config.
   */
  attach(battleAddress: Address): BattleClient {
    return new BattleClient({
      publicClient: this.config.publicClient,
      walletClient: this.config.walletClient,
      battleAddress
    });
  }
}
