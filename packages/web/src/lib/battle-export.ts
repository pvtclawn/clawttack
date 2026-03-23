import type { BattleInfo, SettledEvent, TurnEvent } from '../hooks/useChain'
import { explorerUrl } from './format'

const PHASE_NAMES = ['Open', 'Active', 'Settled', 'Cancelled'] as const
const RESULT_TYPES = ['None', 'Compromise', 'Invalid Solution', 'Poison Violation', 'Timeout', 'Bank Empty', 'NCC Reveal Failed', 'VOP Reveal Failed'] as const
const TRANSCRIPT_EXPORT_VERSION = 'clawttack-battle-transcript/v1' as const

export interface BattleTranscriptExport {
  version: typeof TRANSCRIPT_EXPORT_VERSION
  exportedAt: string
  chain: {
    name: 'base-sepolia'
    explorerBaseUrl: string
  }
  battle: {
    battleId: string
    address: string
    state: number
    stateLabel: string
    currentTurn: number
    maxTurns: number
    totalPotWei: string
    firstMoverA: boolean
    bankA: number | null
    bankB: number | null
    sequenceHash: string
    battleUrl: string
    contractUrl: string
  }
  players: {
    challenger: {
      agentId: string
      owner: string
      label: string
    }
    acceptor: {
      agentId: string
      owner: string
      label: string
    }
  }
  settlement: null | {
    winnerId: string
    loserId: string
    resultType: number
    resultLabel: string
    txHash: string
    txUrl: string
    blockNumber: string
  }
  turns: Array<{
    turnNumber: number
    playerId: string
    playerRole: 'challenger' | 'acceptor' | 'unknown'
    playerLabel: string
    narrative: string
    targetWordIndex: number
    poisonWord: string
    sequenceHash: string
    bankA: number | null
    bankB: number | null
    blockNumber: string
    timestamp: number | null
    timestampIso: string | null
    txHash: string
    txUrl: string
  }>
}

function phaseLabel(state: number): string {
  return PHASE_NAMES[state] ?? `Unknown (${state})`
}

function resultLabel(resultType: number): string {
  return RESULT_TYPES[resultType] ?? `Unknown (${resultType})`
}

function playerRole(info: BattleInfo, playerId: bigint): 'challenger' | 'acceptor' | 'unknown' {
  if (playerId === info.challengerId) return 'challenger'
  if (playerId === info.acceptorId) return 'acceptor'
  return 'unknown'
}

function playerLabel(info: BattleInfo, playerId: bigint, challengerName: string, acceptorName: string): string {
  const role = playerRole(info, playerId)
  if (role === 'challenger') return challengerName
  if (role === 'acceptor') return acceptorName
  return `Agent #${playerId.toString()}`
}

export function buildBattleTranscriptExport(input: {
  origin: string
  info: BattleInfo
  turns: TurnEvent[]
  settlement: SettledEvent | null | undefined
  challengerName: string
  acceptorName: string
}): BattleTranscriptExport {
  const { origin, info, turns, settlement, challengerName, acceptorName } = input

  return {
    version: TRANSCRIPT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    chain: {
      name: 'base-sepolia',
      explorerBaseUrl: 'https://sepolia.basescan.org',
    },
    battle: {
      battleId: info.battleId.toString(),
      address: info.address,
      state: info.state,
      stateLabel: phaseLabel(info.state),
      currentTurn: info.currentTurn,
      maxTurns: info.maxTurns,
      totalPotWei: info.totalPot.toString(),
      firstMoverA: info.firstMoverA,
      bankA: info.bankA ?? null,
      bankB: info.bankB ?? null,
      sequenceHash: info.sequenceHash,
      battleUrl: `${origin}/battle/${info.battleId.toString()}`,
      contractUrl: explorerUrl('address', info.address),
    },
    players: {
      challenger: {
        agentId: info.challengerId.toString(),
        owner: info.challengerOwner,
        label: challengerName,
      },
      acceptor: {
        agentId: info.acceptorId.toString(),
        owner: info.acceptorOwner,
        label: acceptorName,
      },
    },
    settlement: settlement
      ? {
          winnerId: settlement.winnerId.toString(),
          loserId: settlement.loserId.toString(),
          resultType: settlement.resultType,
          resultLabel: resultLabel(settlement.resultType),
          txHash: settlement.txHash,
          txUrl: explorerUrl('tx', settlement.txHash),
          blockNumber: settlement.blockNumber.toString(),
        }
      : null,
    turns: turns.map((turn) => ({
      turnNumber: turn.turnNumber,
      playerId: turn.playerId.toString(),
      playerRole: playerRole(info, turn.playerId),
      playerLabel: playerLabel(info, turn.playerId, challengerName, acceptorName),
      narrative: turn.narrative,
      targetWordIndex: turn.targetWord,
      poisonWord: turn.poisonWord,
      sequenceHash: turn.sequenceHash,
      bankA: turn.bankA ?? null,
      bankB: turn.bankB ?? null,
      blockNumber: turn.blockNumber.toString(),
      timestamp: turn.timestamp ?? null,
      timestampIso: turn.timestamp ? new Date(turn.timestamp * 1000).toISOString() : null,
      txHash: turn.txHash,
      txUrl: explorerUrl('tx', turn.txHash),
    })),
  }
}

export function battleTranscriptFilename(battleId: bigint | number | string): string {
  return `clawttack-battle-${battleId.toString()}-transcript.json`
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
