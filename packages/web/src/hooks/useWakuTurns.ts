// useWakuTurns — V3 stub
//
// Waku live broadcast will be re-enabled when the V3 relay is ready.
// For now, the UI uses on-chain polling via useBattleTurns().

import { useState } from 'react'

export interface WakuTurnEvent {
  battleId: string
  turnNumber: number
  narrative: string
  txHash: string
}

/** Stub: returns empty array until Waku relay is V3-ready */
export function useWakuTurns(_battleAddress?: string) {
  const [turns] = useState<WakuTurnEvent[]>([])
  return {
    turns,
    connected: false,
    error: null as string | null,
  }
}
