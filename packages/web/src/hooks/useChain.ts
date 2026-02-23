/**
 * useChain.ts — V3 on-chain data hooks for Clawttack Arena
 * 
 * V3 Architecture:
 *   Arena (factory) creates Battle clones.
 *   battleId is uint256, not bytes32.
 *   Battle state lives on each clone (read directly from clone address).
 *   TurnSubmitted events are emitted by individual Battle clones.
 */

import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { CONTRACTS, ARENA_DEPLOY_BLOCK } from '../config/wagmi'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org', {
    retryCount: 3,
    retryDelay: 1000,
  }),
})

// Max block range per getLogs request (public RPCs reject large ranges)
const CHUNK_SIZE = 10_000n

/** Fetch logs in chunks to avoid 413 errors from public RPCs */
async function getLogsChunked<T>(params: {
  address: Address
  event: ReturnType<typeof parseAbiItem>
  fromBlock: bigint
  args?: Record<string, unknown>
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
        args: params.args as any,
        fromBlock: from,
        toBlock: to,
      })
      results.push(...logs.map(params.mapFn))
    } catch (err) {
      console.warn(`getLogs failed for range ${from}-${to}, retrying smaller`, err)
      const mid = from + (to - from) / 2n
      if (mid === from) throw err
      const remaining = await getLogsChunked({ ...params, fromBlock: from })
      results.push(...remaining)
      break
    }

    from = to + 1n
  }

  return results
}

// ─── V3 Types ────────────────────────────────────────────────────────

export interface V3BattleCreatedEvent {
  battleId: bigint
  challengerId: bigint
  stake: bigint
  baseTimeoutBlocks: number
  maxTurns: number
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface V3BattleInfo {
  battleId: bigint
  address: Address
  state: number          // 0=Open, 1=Active, 2=Settled, 3=Cancelled
  challengerId: bigint
  acceptorId: bigint
  challengerOwner: Address
  acceptorOwner: Address
  currentTurn: number
  maxTurns: number
  turnDeadlineBlock: bigint
  sequenceHash: `0x${string}`
  totalPot: bigint
}

export interface V3TurnEvent {
  battleId: bigint
  turnNumber: number
  playerId: bigint
  sequenceHash: `0x${string}`
  targetWord: number
  poisonWord: number
  narrative: string
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface V3SettledEvent {
  battleId: bigint
  winnerId: bigint
  loserId: bigint
  resultType: number  // 0=MaxTurns, 1=Timeout, 2=Compromise, 3=Cancel
  blockNumber: bigint
  txHash: `0x${string}`
}

export interface V3AgentProfile {
  agentId: bigint
  owner: Address
  eloRating: number
  totalWins: number
  totalLosses: number
}

// ─── Arena (factory) ABI fragments ──────────────────────────────────

const ARENA_ABI = [
  { type: 'function', name: 'battlesCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'agentsCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'battles', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'agents', inputs: [{ name: 'id', type: 'uint256' }], outputs: [
    { name: 'owner', type: 'address' },
    { name: 'eloRating', type: 'uint32' },
    { name: 'totalWins', type: 'uint32' },
    { name: 'totalLosses', type: 'uint32' },
  ], stateMutability: 'view' },
] as const

// ─── Battle (clone) ABI fragments ───────────────────────────────────

const BATTLE_ABI = [
  { type: 'function', name: 'state', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'battleId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'challengerId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'acceptorId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'challengerOwner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'acceptorOwner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'currentTurn', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'turnDeadlineBlock', inputs: [], outputs: [{ type: 'uint64' }], stateMutability: 'view' },
  { type: 'function', name: 'sequenceHash', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
  { type: 'function', name: 'totalPot', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'targetWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'poisonWordIndex', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
  { type: 'function', name: 'jokersRemainingA', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'jokersRemainingB', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
] as const

const WORD_DICTIONARY_ABI = [
  { type: 'function', name: 'word', inputs: [{ name: 'index', type: 'uint16' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'wordCount', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
] as const

const BATTLE_CONFIG_ABI = [
  { type: 'function', name: 'config', inputs: [], outputs: [
    { name: 'stake', type: 'uint256' },
    { name: 'baseTimeoutBlocks', type: 'uint32' },
    { name: 'warmupBlocks', type: 'uint32' },
    { name: 'targetAgentId', type: 'uint256' },
    { name: 'maxTurns', type: 'uint8' },
    { name: 'maxJokers', type: 'uint8' },
  ], stateMutability: 'view' },
] as const

// ─── Arena-level hooks ──────────────────────────────────────────────

/** Get total battle and agent counts from the Arena factory */
export function useArenaStats() {
  return useQuery({
    queryKey: ['v3', 'arena', 'stats'],
    queryFn: async () => {
      const [battlesCount, agentsCount] = await Promise.all([
        client.readContract({ address: CONTRACTS.arena, abi: ARENA_ABI, functionName: 'battlesCount' }),
        client.readContract({ address: CONTRACTS.arena, abi: ARENA_ABI, functionName: 'agentsCount' }),
      ])
      return { battlesCount: battlesCount as bigint, agentsCount: agentsCount as bigint }
    },
    staleTime: 15_000,
  })
}

/** Get all BattleCreated events from the Arena */
export function useBattleCreatedEvents(live = false) {
  return useQuery({
    queryKey: ['v3', 'battles', 'created'],
    queryFn: async (): Promise<V3BattleCreatedEvent[]> => {
      return getLogsChunked({
        address: CONTRACTS.arena,
        event: parseAbiItem('event BattleCreated(uint256 indexed battleId, uint256 indexed challengerId, uint256 stake, uint32 baseTimeoutBlocks, uint8 maxTurns)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          challengerId: log.args.challengerId!,
          stake: log.args.stake!,
          baseTimeoutBlocks: Number(log.args.baseTimeoutBlocks!),
          maxTurns: Number(log.args.maxTurns!),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: live ? 0 : 5 * 60_000,
    refetchInterval: live ? 10_000 : false,
  })
}

/** Fetch the full info for a single battle by looking up its clone address */
export function useBattleInfo(battleId?: bigint, live = false) {
  return useQuery({
    queryKey: ['v3', 'battle', battleId?.toString()],
    enabled: battleId !== undefined,
    queryFn: async (): Promise<V3BattleInfo> => {
      // 1. Resolve clone address from Arena factory
      const battleAddress = await client.readContract({
        address: CONTRACTS.arena,
        abi: ARENA_ABI,
        functionName: 'battles',
        args: [battleId!],
      }) as Address

      // 2. Read all state from the clone
      const [state, challId, accId, challOwner, accOwner, turn, deadline, seqHash, pot] = await Promise.all([
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'state' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'challengerId' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'acceptorId' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'challengerOwner' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'acceptorOwner' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'currentTurn' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'turnDeadlineBlock' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'sequenceHash' }),
        client.readContract({ address: battleAddress, abi: BATTLE_ABI, functionName: 'totalPot' }),
      ])

      // 3. Read config for maxTurns
      const config = await client.readContract({
        address: battleAddress,
        abi: BATTLE_CONFIG_ABI,
        functionName: 'config',
      }) as [bigint, number, number, bigint, number, number]

      return {
        battleId: battleId!,
        address: battleAddress,
        state: Number(state),
        challengerId: challId as bigint,
        acceptorId: accId as bigint,
        challengerOwner: challOwner as Address,
        acceptorOwner: accOwner as Address,
        currentTurn: Number(turn),
        maxTurns: config[4], // maxTurns from BattleConfig
        turnDeadlineBlock: deadline as bigint,
        sequenceHash: seqHash as `0x${string}`,
        totalPot: pot as bigint,
      }
    },
    staleTime: live ? 0 : 30_000,
    refetchInterval: live ? 4_000 : false,
  })
}

/** Fetch a list of all battles with their clone addresses + basic state */
export function useBattleList(live = false) {
  const statsQuery = useArenaStats()

  return useQuery({
    queryKey: ['v3', 'battles', 'list', statsQuery.data?.battlesCount?.toString()],
    enabled: !!statsQuery.data,
    queryFn: async (): Promise<V3BattleInfo[]> => {
      const count = Number(statsQuery.data!.battlesCount)
      if (count === 0) return []

      // Fetch all battles in parallel (limited to 20 most recent for perf)
      const start = Math.max(1, count - 19)
      const ids = Array.from({ length: count - start + 1 }, (_, i) => BigInt(start + i))

      const battles = await Promise.all(
        ids.map(async (id) => {
          try {
            const addr = await client.readContract({
              address: CONTRACTS.arena, abi: ARENA_ABI, functionName: 'battles', args: [id],
            }) as Address

            if (addr === '0x0000000000000000000000000000000000000000') return null

            const [state, challId, accId, challOwner, accOwner, turn, deadline, seqHash, pot] = await Promise.all([
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'state' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'challengerId' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'acceptorId' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'challengerOwner' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'acceptorOwner' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'currentTurn' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'turnDeadlineBlock' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'sequenceHash' }),
              client.readContract({ address: addr, abi: BATTLE_ABI, functionName: 'totalPot' }),
            ])

            const config = await client.readContract({
              address: addr, abi: BATTLE_CONFIG_ABI, functionName: 'config',
            }) as [bigint, number, number, bigint, number, number]

            return {
              battleId: id,
              address: addr,
              state: Number(state),
              challengerId: challId as bigint,
              acceptorId: accId as bigint,
              challengerOwner: challOwner as Address,
              acceptorOwner: accOwner as Address,
              currentTurn: Number(turn),
              maxTurns: config[4],
              turnDeadlineBlock: deadline as bigint,
              sequenceHash: seqHash as `0x${string}`,
              totalPot: pot as bigint,
            } as V3BattleInfo
          } catch {
            return null
          }
        })
      )

      return battles.filter((b): b is V3BattleInfo => b !== null).reverse()
    },
    staleTime: live ? 0 : 30_000,
    refetchInterval: live ? 10_000 : false,
  })
}

/** Get turn events for a specific battle clone */
export function useBattleTurns(battleAddress?: Address, live = false) {
  return useQuery({
    queryKey: ['v3', 'turns', battleAddress],
    enabled: !!battleAddress,
    queryFn: async (): Promise<V3TurnEvent[]> => {
      return getLogsChunked({
        address: battleAddress!,
        event: parseAbiItem('event TurnSubmitted(uint256 indexed battleId, uint32 turnNumber, uint256 indexed playerId, bytes32 sequenceHash, uint16 targetWord, uint16 poisonWord, bytes nextVopParams, string narrative)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          turnNumber: Number(log.args.turnNumber!),
          playerId: log.args.playerId!,
          sequenceHash: log.args.sequenceHash!,
          targetWord: Number(log.args.targetWord!),
          poisonWord: Number(log.args.poisonWord!),
          narrative: log.args.narrative!,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
    },
    staleTime: live ? 0 : 5 * 60_000,
    refetchInterval: live ? 4_000 : false,
  })
}

/** Get settlement events for a specific battle */
export function useBattleSettlement(battleAddress?: Address) {
  return useQuery({
    queryKey: ['v3', 'settlement', battleAddress],
    enabled: !!battleAddress,
    queryFn: async (): Promise<V3SettledEvent | null> => {
      const events = await getLogsChunked({
        address: battleAddress!,
        event: parseAbiItem('event BattleSettled(uint256 indexed battleId, uint256 indexed winnerId, uint256 indexed loserId, uint8 resultType)'),
        fromBlock: ARENA_DEPLOY_BLOCK,
        mapFn: (log) => ({
          battleId: log.args.battleId!,
          winnerId: log.args.winnerId!,
          loserId: log.args.loserId!,
          resultType: Number(log.args.resultType!),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash!,
        }),
      })
      return events[0] ?? null
    },
    staleTime: 5 * 60_000,
  })
}

/** Get an agent profile by ID */
export function useAgentProfile(agentId?: bigint) {
  return useQuery({
    queryKey: ['v3', 'agent', agentId?.toString()],
    enabled: agentId !== undefined && agentId > 0n,
    queryFn: async (): Promise<V3AgentProfile> => {
      const result = await client.readContract({
        address: CONTRACTS.arena,
        abi: ARENA_ABI,
        functionName: 'agents',
        args: [agentId!],
      }) as [Address, number, number, number]

      return {
        agentId: agentId!,
        owner: result[0],
        eloRating: Number(result[1]),
        totalWins: Number(result[2]),
        totalLosses: Number(result[3]),
      }
    },
    staleTime: 60_000,
  })
}

/** Resolve a BIP39 word by index */
export function useWord(wordIndex?: number) {
  return useQuery({
    queryKey: ['v3', 'word', wordIndex],
    enabled: wordIndex !== undefined,
    queryFn: async (): Promise<string> => {
      return await client.readContract({
        address: CONTRACTS.wordDictionary,
        abi: WORD_DICTIONARY_ABI,
        functionName: 'word',
        args: [wordIndex!],
      }) as string
    },
    staleTime: Infinity, // Words never change
  })
}
