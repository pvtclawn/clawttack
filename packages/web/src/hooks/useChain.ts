import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'
import { CONTRACTS } from '../config/wagmi'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

// Contract deploy block (ClawttackRegistry on Base Sepolia)
const DEPLOY_BLOCK = 37_752_000n

export interface BattleCreatedEvent {
  battleId: `0x${string}`
  scenario: `0x${string}`
  agents: readonly `0x${string}`[]
  entryFee: bigint
  commitment: `0x${string}`
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface BattleSettledEvent {
  battleId: `0x${string}`
  winner: `0x${string}`
  turnLogCid: `0x${string}`
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface AgentStats {
  address: `0x${string}`
  elo: number
  wins: number
  losses: number
  draws: number
  lastActiveAt: bigint
}

export function useBattleCreatedEvents() {
  return useQuery({
    queryKey: ['battles', 'created'],
    queryFn: async (): Promise<BattleCreatedEvent[]> => {
      const logs = await client.getLogs({
        address: CONTRACTS.registry,
        event: parseAbiItem('event BattleCreated(bytes32 indexed battleId, address indexed scenario, address[] agents, uint256 entryFee, bytes32 commitment)'),
        fromBlock: DEPLOY_BLOCK, // Approximate deploy block
        toBlock: 'latest',
      })

      return logs.map((log) => ({
        battleId: log.args.battleId!,
        scenario: log.args.scenario!,
        agents: log.args.agents!,
        entryFee: log.args.entryFee!,
        commitment: log.args.commitment!,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
      }))
    },
    staleTime: 30_000, // 30s
  })
}

export function useBattleSettledEvents() {
  return useQuery({
    queryKey: ['battles', 'settled'],
    queryFn: async (): Promise<BattleSettledEvent[]> => {
      const logs = await client.getLogs({
        address: CONTRACTS.registry,
        event: parseAbiItem('event BattleSettled(bytes32 indexed battleId, address indexed winner, bytes32 turnLogCid, uint256 payout)'),
        fromBlock: DEPLOY_BLOCK,
        toBlock: 'latest',
      })

      return logs.map((log) => ({
        battleId: log.args.battleId!,
        winner: log.args.winner!,
        turnLogCid: log.args.turnLogCid!,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
      }))
    },
    staleTime: 30_000,
  })
}

export function useAgentStats(address: `0x${string}`) {
  return useQuery({
    queryKey: ['agent', address],
    queryFn: async (): Promise<AgentStats> => {
      const result = await client.readContract({
        address: CONTRACTS.registry,
        abi: [{
          type: 'function',
          name: 'agents',
          inputs: [{ name: '', type: 'address' }],
          outputs: [
            { name: 'elo', type: 'uint32' },
            { name: 'wins', type: 'uint32' },
            { name: 'losses', type: 'uint32' },
            { name: 'draws', type: 'uint32' },
            { name: 'lastActiveAt', type: 'uint256' },
          ],
          stateMutability: 'view',
        }],
        functionName: 'agents',
        args: [address],
      })

      return {
        address,
        elo: Number(result[0]),
        wins: Number(result[1]),
        losses: Number(result[2]),
        draws: Number(result[3]),
        lastActiveAt: result[4],
      }
    },
    staleTime: 60_000,
  })
}
