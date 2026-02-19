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

// Contract deploy blocks (Base Sepolia)
const REGISTRY_DEPLOY_BLOCK = 37_752_000n
const ARENA_DEPLOY_BLOCK = 38_000_000n

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
        fromBlock: REGISTRY_DEPLOY_BLOCK,
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
    // Historical chain events don't change — cache for 5 minutes
    staleTime: 5 * 60_000,
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
        fromBlock: REGISTRY_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          winner: log.args.winner!,
          turnLogCid: log.args.turnLogCid!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    // Historical chain events don't change — cache for 5 minutes
    staleTime: 5 * 60_000,
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

// ─── Arena hooks (ClawttackArena v2) ─────────────────────────────────

export interface ArenaChallengeEvent {
  battleId: `0x${string}`
  challenger: `0x${string}`
  stake: bigint
  commitA: `0x${string}`
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface ArenaAcceptEvent {
  battleId: `0x${string}`
  opponent: `0x${string}`
  commitB: `0x${string}`
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface ArenaTurnEvent {
  battleId: `0x${string}`
  agent: `0x${string}`
  turnNumber: number
  message: string
  wordFound: boolean
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface ArenaSettledEvent {
  battleId: `0x${string}`
  winner: `0x${string}`
  finalTurn: number
  reason: string
  blockNumber: bigint
  txHash: `0x${string}`
}

export function useArenaChallenges() {
  return useQuery({
    queryKey: ['arena', 'challenges'],
    queryFn: async (): Promise<ArenaChallengeEvent[]> => {
      return getLogsChunked({
        address: CONTRACTS.arena,
        event: parseAbiItem('event ChallengeCreated(bytes32 indexed battleId, address indexed challenger, uint256 stake, bytes32 commitA)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          challenger: log.args.challenger!,
          stake: log.args.stake!,
          commitA: log.args.commitA!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: 5 * 60_000,
    retry: 2,
  })
}

export function useArenaAccepts() {
  return useQuery({
    queryKey: ['arena', 'accepts'],
    queryFn: async (): Promise<ArenaAcceptEvent[]> => {
      return getLogsChunked({
        address: CONTRACTS.arena,
        event: parseAbiItem('event ChallengeAccepted(bytes32 indexed battleId, address indexed opponent, bytes32 commitB)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          opponent: log.args.opponent!,
          commitB: log.args.commitB!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: 5 * 60_000,
    retry: 2,
  })
}

export function useArenaTurns(battleId?: `0x${string}`) {
  return useQuery({
    queryKey: ['arena', 'turns', battleId],
    enabled: !!battleId,
    queryFn: async (): Promise<ArenaTurnEvent[]> => {
      return getLogsChunked({
        address: CONTRACTS.arena,
        event: parseAbiItem('event TurnSubmitted(bytes32 indexed battleId, address indexed agent, uint8 turnNumber, string message, bool wordFound)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          agent: log.args.agent!,
          turnNumber: Number(log.args.turnNumber!),
          message: log.args.message!,
          wordFound: log.args.wordFound!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: 5 * 60_000,
    retry: 2,
  })
}

export function useArenaSettlements() {
  return useQuery({
    queryKey: ['arena', 'settlements'],
    queryFn: async (): Promise<ArenaSettledEvent[]> => {
      return getLogsChunked({
        address: CONTRACTS.arena,
        event: parseAbiItem('event BattleSettled(bytes32 indexed battleId, address indexed winner, uint8 finalTurn, string reason)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          winner: log.args.winner!,
          finalTurn: Number(log.args.finalTurn!),
          reason: log.args.reason!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: 5 * 60_000,
    retry: 2,
  })
}
