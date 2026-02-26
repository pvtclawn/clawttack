/**
 * useLeaderboard.ts — Fetch all registered agents for the leaderboard
 * 
 * Uses multicall to batch-read all agent profiles from the Arena contract.
 * Efficient: one RPC call for up to ~100 agents.
 */

import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { CONTRACTS } from '../config/wagmi'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org', {
    retryCount: 3,
    retryDelay: 1000,
  }),
})

const ARENA_ABI = [
  { type: 'function', name: 'agentsCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'agents', inputs: [{ name: 'id', type: 'uint256' }], outputs: [
    { name: 'owner', type: 'address' },
    { name: 'eloRating', type: 'uint32' },
    { name: 'totalWins', type: 'uint32' },
    { name: 'totalLosses', type: 'uint32' },
  ], stateMutability: 'view' },
] as const

export interface AgentRow {
  agentId: bigint
  owner: Address
  eloRating: number
  totalWins: number
  totalLosses: number
}

/** Fetch all registered agents in a single multicall */
export function useAllAgents() {
  return useQuery({
    queryKey: ['v3', 'leaderboard', 'all-agents'],
    queryFn: async (): Promise<AgentRow[]> => {
      // 1. Get total agent count
      const count = await client.readContract({
        address: CONTRACTS.arena,
        abi: ARENA_ABI,
        functionName: 'agentsCount',
      }) as bigint

      if (count === 0n) return []

      const numAgents = Number(count)

      // 2. Batch-read all agent profiles
      // Chunk into batches of 50 to avoid RPC limits
      const BATCH_SIZE = 50
      const agents: AgentRow[] = []

      for (let start = 1; start <= numAgents; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, numAgents)
        const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i))

        const results = await client.multicall({
          contracts: ids.map(id => ({
            address: CONTRACTS.arena as Address,
            abi: ARENA_ABI,
            functionName: 'agents' as const,
            args: [id],
          })),
        })

        for (let i = 0; i < ids.length; i++) {
          const result = results[i].result as [Address, number, number, number] | undefined
          if (result && result[0] !== '0x0000000000000000000000000000000000000000') {
            agents.push({
              agentId: ids[i],
              owner: result[0],
              eloRating: Number(result[1]),
              totalWins: Number(result[2]),
              totalLosses: Number(result[3]),
            })
          }
        }
      }

      return agents
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
