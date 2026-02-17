import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'
import { CONTRACTS } from '../config/wagmi'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org', {
    retryCount: 3,
    retryDelay: 1000,
  }),
})

// Contract deploy block (ClawttackRegistry on Base Sepolia)
const DEPLOY_BLOCK = 37_752_000n

// Max block range per getLogs request (public RPCs reject large ranges)
const CHUNK_SIZE = 10_000n

/** Fetch logs in chunks to avoid 413 errors from public RPCs */
async function getLogsChunked<T>(params: {
  address: `0x${string}`
  event: ReturnType<typeof parseAbiItem>
  fromBlock: bigint
  mapFn: (log: any) => T
}): Promise<T[]> {
  const latestBlock = await client.getBlockNumber()
  const results: T[] = []

  let from = params.fromBlock
  while (from <= latestBlock) {
    const to = from + CHUNK_SIZE > latestBlock ? latestBlock : from + CHUNK_SIZE

    try {
      const logs = await client.getLogs({
        address: params.address,
        event: params.event as any,
        fromBlock: from,
        toBlock: to,
      })
      results.push(...logs.map(params.mapFn))
    } catch (err) {
      // If chunk is still too big, halve it and retry
      console.warn(`getLogs failed for range ${from}-${to}, retrying smaller`, err)
      const mid = from + (to - from) / 2n
      if (mid === from) throw err // Can't split further

      const firstHalf = await getLogsChunked({ ...params, fromBlock: from })
      results.push(...firstHalf)
    }

    from = to + 1n
  }

  return results
}

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
      return getLogsChunked({
        address: CONTRACTS.registry,
        event: parseAbiItem('event BattleCreated(bytes32 indexed battleId, address indexed scenario, address[] agents, uint256 entryFee, bytes32 commitment)'),
        fromBlock: DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          scenario: log.args.scenario!,
          agents: log.args.agents!,
          entryFee: log.args.entryFee!,
          commitment: log.args.commitment!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: 60_000,
    retry: 2,
  })
}

export function useBattleSettledEvents() {
  return useQuery({
    queryKey: ['battles', 'settled'],
    queryFn: async (): Promise<BattleSettledEvent[]> => {
      return getLogsChunked({
        address: CONTRACTS.registry,
        event: parseAbiItem('event BattleSettled(bytes32 indexed battleId, address indexed winner, bytes32 turnLogCid, uint256 payout)'),
        fromBlock: DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          winner: log.args.winner!,
          turnLogCid: log.args.turnLogCid!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: 60_000,
    retry: 2,
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
