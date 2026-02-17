import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { agentName, scenarioName } from '../lib/format'

// Map scenarioId strings to known scenario addresses
const SCENARIO_ADDRS: Record<string, string> = {
  'injection-ctf': '0x3D160303816ed14F05EA8784Ef9e021a02B747C4',
}

export const Route = createFileRoute('/battle/$id')({
  component: BattlePage,
})

interface Turn {
  agentAddress: string
  message: string
  turnNumber: number
  timestamp: number
  signature: string
  role: string
}

interface BattleLog {
  battleId: string
  scenarioId: string
  agents: Array<{ address: string; name: string }>
  turns: Turn[]
  outcome: { winnerAddress: string | null; reason: string } | null
  commitment: string
  merkleRoot?: string
}

function useBattleLog(battleIdHash: string) {
  return useQuery({
    queryKey: ['battleLog', battleIdHash],
    queryFn: async (): Promise<BattleLog | null> => {
      try {
        const res = await fetch(`/battles/${battleIdHash}.json`)
        if (!res.ok) return null
        return await res.json()
      } catch {
        return null
      }
    },
  })
}

function BattlePage() {
  const { id } = Route.useParams()
  const { data: log, isLoading } = useBattleLog(id)
  const [visibleTurns, setVisibleTurns] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)

  const startReplay = () => {
    setVisibleTurns(0)
    setIsReplaying(true)
  }

  const showAll = () => {
    if (log) {
      setVisibleTurns(log.turns.length)
      setIsReplaying(false)
    }
  }

  useEffect(() => {
    if (!isReplaying || !log) return
    if (visibleTurns >= log.turns.length) {
      setIsReplaying(false)
      return
    }
    const timer = setTimeout(() => {
      setVisibleTurns((v) => v + 1)
    }, 1500)
    return () => clearTimeout(timer)
  }, [isReplaying, visibleTurns, log])

  // Auto-show all on load
  useEffect(() => {
    if (log && !isReplaying && visibleTurns === 0) {
      setVisibleTurns(log.turns.length)
    }
  }, [log])

  if (isLoading) {
    return (
      <div className="py-12 text-center text-[var(--muted)]">
        ⏳ Loading battle log...
      </div>
    )
  }

  if (!log) {
    return (
      <div className="space-y-4 py-12 text-center">
        <div className="text-[var(--muted)]">Battle log not found</div>
        <div className="text-xs text-[var(--muted)] font-mono break-all">{id}</div>
        <Link to="/battles" className="text-sm text-[var(--accent)]">
          ← Back to battles
        </Link>
      </div>
    )
  }

  const displayedTurns = log.turns.slice(0, visibleTurns)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/battles" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
            ← Battles
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {log.agents.map((a) => agentName(a.address)).join(' vs ')}
          </h1>
          <div className="text-sm text-[var(--muted)]">
            {scenarioName(SCENARIO_ADDRS[log.scenarioId] ?? log.scenarioId)} · {log.turns.length} turns
          </div>
          <div className="mt-1 flex gap-3 text-xs text-[var(--muted)]">
            <a
              href={`https://sepolia.basescan.org/address/0xeee01a6846C896efb1a43442434F1A51BF87d3aA`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Registry ↗
            </a>
            <span className="font-mono break-all">{id.slice(0, 16)}…</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startReplay}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            ▶ Replay
          </button>
          <button
            onClick={showAll}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            Show All
          </button>
        </div>
      </div>

      {/* Outcome */}
      {log.outcome && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <div>
              <div className="font-medium">
                {log.outcome.winnerAddress
                  ? `Winner: ${agentName(log.outcome.winnerAddress)}`
                  : 'Draw'}
              </div>
              <div className="text-xs text-[var(--muted)]">{log.outcome.reason}</div>
            </div>
          </div>
        </div>
      )}

      {/* Turn-by-turn transcript */}
      <div className="space-y-3">
        {displayedTurns.map((turn) => {
          const isAttacker = turn.role === 'attacker'
          return (
            <div
              key={turn.turnNumber}
              className={`flex ${isAttacker ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-4 ${
                  isAttacker
                    ? 'bg-red-950/30 border border-red-900/30'
                    : 'bg-blue-950/30 border border-blue-900/30'
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span>{isAttacker ? '🗡️' : '🛡️'}</span>
                  <span className={isAttacker ? 'text-red-400' : 'text-blue-400'}>
                    {agentName(turn.agentAddress)}
                  </span>
                  <span className="text-[var(--muted)]">Turn {turn.turnNumber}</span>
                </div>
                <div className="text-sm leading-relaxed">{turn.message}</div>
                <div className="mt-2 text-[10px] text-[var(--muted)] font-mono truncate">
                  sig: {turn.signature.slice(0, 20)}…
                </div>
              </div>
            </div>
          )
        })}
        {isReplaying && visibleTurns < log.turns.length && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <span className="animate-pulse">●</span> Next turn...
            </div>
          </div>
        )}
      </div>

      {/* Verification */}
      {log.merkleRoot && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--muted)]">
            Merkle Root: <span className="font-mono">{log.merkleRoot}</span>
          </div>
        </div>
      )}
    </div>
  )
}
