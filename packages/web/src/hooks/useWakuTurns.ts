// useWakuTurns — subscribe to live Arena turn broadcasts via Waku
//
// Connects to nwaku REST API's store endpoint to retrieve recent turns
// for a battle. Falls back gracefully if nwaku is unavailable.
//
// This is the "fast lane" — turns appear in <1s vs 4s on-chain polling.
// On-chain events remain the source of truth and verify everything.

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ArenaTurnEvent } from './useChain'

/** Waku arena turn message (matches protocol/src/waku-broadcaster.ts) */
interface WakuArenaTurn {
  type: 'arena_turn'
  battleId: string
  agent: string
  turnNumber: number
  message: string
  txHash: string
  timestamp: number
}

/** Build content topic for a battle */
function arenaTopic(battleId: string): string {
  return `/clawttack/1/arena-${battleId}/proto`
}

interface UseWakuTurnsConfig {
  /** Battle ID to subscribe to */
  battleId?: `0x${string}`
  /** Whether the battle is live (accepted, not settled) */
  enabled?: boolean
  /** nwaku REST API URL */
  nwakuRestUrl?: string
  /** Poll interval in ms (default: 2000) */
  pollIntervalMs?: number
}

/**
 * Subscribe to live Arena turns via Waku.
 *
 * Returns turns received from Waku that may not yet be in the on-chain cache.
 * The parent component should merge these with on-chain turns, deduplicating by turnNumber.
 */
export function useWakuTurns(config: UseWakuTurnsConfig) {
  const {
    battleId,
    enabled = false,
    nwakuRestUrl = import.meta.env.VITE_NWAKU_REST_URL,
    pollIntervalMs = 2000,
  } = config

  const [wakuTurns, setWakuTurns] = useState<ArenaTurnEvent[]>([])
  const [connected, setConnected] = useState(false)
  const seenTurns = useRef(new Set<number>())
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const fetchWakuMessages = useCallback(async () => {
    if (!battleId || !nwakuRestUrl) return

    try {
      const contentTopic = encodeURIComponent(arenaTopic(battleId))
      // Use nwaku store API to get recent messages
      const res = await fetch(
        `${nwakuRestUrl}/store/v1/messages?contentTopics=${contentTopic}&pageSize=50`,
        { signal: AbortSignal.timeout(3_000) }
      )

      if (!res.ok) {
        setConnected(false)
        return
      }

      setConnected(true)
      const data = await res.json()
      const messages: { payload: string }[] = data.messages ?? []

      for (const msg of messages) {
        try {
          const decoded = JSON.parse(atob(msg.payload)) as WakuArenaTurn
          if (decoded.type !== 'arena_turn') continue
          if (decoded.battleId !== battleId) continue
          if (seenTurns.current.has(decoded.turnNumber)) continue

          seenTurns.current.add(decoded.turnNumber)

          const turnEvent: ArenaTurnEvent = {
            battleId: decoded.battleId as `0x${string}`,
            agent: decoded.agent as `0x${string}`,
            turnNumber: decoded.turnNumber,
            message: decoded.message,
            wordFound: true, // optimistic — on-chain verification will confirm
            blockNumber: 0n, // filled by on-chain data later
            txHash: decoded.txHash as `0x${string}`,
          }

          setWakuTurns(prev => {
            // Deduplicate
            if (prev.some(t => t.turnNumber === turnEvent.turnNumber)) return prev
            return [...prev, turnEvent].sort((a, b) => a.turnNumber - b.turnNumber)
          })
        } catch {
          // skip malformed messages
        }
      }
    } catch {
      setConnected(false)
    }
  }, [battleId, nwakuRestUrl])

  useEffect(() => {
    if (!enabled || !battleId || !nwakuRestUrl) {
      setConnected(false)
      return
    }

    // Initial fetch
    fetchWakuMessages()

    // Poll
    intervalRef.current = setInterval(fetchWakuMessages, pollIntervalMs)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, battleId, nwakuRestUrl, pollIntervalMs, fetchWakuMessages])

  // Reset when battle changes
  useEffect(() => {
    seenTurns.current.clear()
    setWakuTurns([])
  }, [battleId])

  return { wakuTurns, connected }
}
