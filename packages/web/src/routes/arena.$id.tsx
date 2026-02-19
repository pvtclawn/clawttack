import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { agentName } from '../lib/format'
import { CONTRACTS } from '../config/wagmi'
import {
  useArenaChallenges,
  useArenaAccepts,
  useArenaTurns,
  useArenaSettlements,
} from '../hooks/useChain'

export const Route = createFileRoute('/arena/$id')({
  component: ArenaBattlePage,
})

function ArenaBattlePage() {
  const { id } = Route.useParams()
  const battleId = id as `0x${string}`

  const { data: challenges, isLoading: loadingC } = useArenaChallenges()
  const { data: accepts, isLoading: loadingA } = useArenaAccepts()
  const { data: turns, isLoading: loadingT } = useArenaTurns(battleId)
  const { data: settlements, isLoading: loadingS } = useArenaSettlements()

  const [visibleTurns, setVisibleTurns] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)

  const isLoading = loadingC || loadingA || loadingT || loadingS

  const challenge = challenges?.find((c) => c.battleId === battleId)
  const accept = accepts?.find((a) => a.battleId === battleId)
  const settlement = settlements?.find((s) => s.battleId === battleId)

  // Sort turns by turnNumber
  const sortedTurns = [...(turns ?? [])].sort((a, b) => a.turnNumber - b.turnNumber)

  // Determine phase
  const phase = settlement ? 'settled' : accept ? 'active' : challenge ? 'open' : 'unknown'
  const agents: `0x${string}`[] = []
  if (challenge) agents.push(challenge.challenger)
  if (accept) agents.push(accept.opponent)

  const startReplay = () => {
    setVisibleTurns(0)
    setIsReplaying(true)
  }

  const showAll = () => {
    setVisibleTurns(sortedTurns.length)
    setIsReplaying(false)
  }

  useEffect(() => {
    if (!isReplaying) return
    if (visibleTurns >= sortedTurns.length) {
      setIsReplaying(false)
      return
    }
    const timer = setTimeout(() => {
      setVisibleTurns((v) => v + 1)
    }, 1500)
    return () => clearTimeout(timer)
  }, [isReplaying, visibleTurns, sortedTurns.length])

  // Auto-show all on load
  useEffect(() => {
    if (sortedTurns.length > 0 && !isReplaying && visibleTurns === 0) {
      setVisibleTurns(sortedTurns.length)
    }
  }, [sortedTurns.length])

  if (isLoading) {
    return (
      <div className="py-12 text-center text-[var(--muted)]">
        ⏳ Loading Arena battle from chain...
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="space-y-4 py-12 text-center">
        <div className="text-[var(--muted)]">Arena battle not found</div>
        <div className="text-xs text-[var(--muted)] font-mono break-all">{battleId}</div>
        <Link to="/battles" className="text-sm text-[var(--accent)]">
          ← Back to battles
        </Link>
      </div>
    )
  }

  const displayedTurns = sortedTurns.slice(0, visibleTurns)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/battles" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
            ← Battles
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            🏟️ {agents.map(agentName).join(' vs ')}
            {agents.length === 1 && (
              <span className="ml-2 text-base text-[var(--muted)]">(open challenge)</span>
            )}
          </h1>
          <div className="text-sm text-[var(--muted)]">
            Arena · {sortedTurns.length} turns · {formatEther(challenge.stake)} ETH stake
          </div>
          <div className="mt-1 flex gap-3 text-xs text-[var(--muted)]">
            <a
              href={`https://sepolia.basescan.org/address/${CONTRACTS.arena}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Arena Contract ↗
            </a>
            <span className="font-mono break-all">{battleId.slice(0, 16)}…</span>
          </div>
        </div>
        {sortedTurns.length > 0 && (
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
        )}
      </div>

      {/* Phase badge */}
      <div className="flex items-center gap-3">
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
          phase === 'settled'
            ? 'bg-green-900/50 text-green-400'
            : phase === 'open'
              ? 'bg-orange-900/50 text-orange-400'
              : 'bg-yellow-900/50 text-yellow-400'
        }`}>
          {phase}
        </span>
        {challenge && (
          <span className="text-xs text-[var(--muted)]">
            Challenger: {agentName(challenge.challenger)}
          </span>
        )}
        {accept && (
          <span className="text-xs text-[var(--muted)]">
            · Opponent: {agentName(accept.opponent)}
          </span>
        )}
      </div>

      {/* Settlement outcome */}
      {settlement && (
        <div className="rounded-xl border border-green-900/50 bg-green-950/20 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <div>
              <div className="font-medium">
                {settlement.winner === '0x0000000000000000000000000000000000000000'
                  ? 'Draw'
                  : `Winner: ${agentName(settlement.winner)}`}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {settlement.reason} · Turn {settlement.finalTurn}
                {' · '}
                <a
                  href={`https://sepolia.basescan.org/tx/${settlement.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  View tx ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Turn-by-turn transcript (from on-chain calldata) */}
      <div className="space-y-3">
        {displayedTurns.map((turn) => {
          const isChallenger = turn.agent.toLowerCase() === challenge.challenger.toLowerCase()
          const bgClass = isChallenger
            ? 'bg-red-950/30 border border-red-900/30'
            : 'bg-blue-950/30 border border-blue-900/30'
          const roleColor = isChallenger ? 'text-red-400' : 'text-blue-400'

          return (
            <div
              key={`${turn.turnNumber}-${turn.agent}`}
              className={`flex ${isChallenger ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[80%] rounded-xl p-4 ${bgClass}`}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span>{isChallenger ? '🗡️' : '🛡️'}</span>
                  <span className={roleColor}>
                    {agentName(turn.agent)}
                  </span>
                  <span className="text-[var(--muted)]">Turn {turn.turnNumber}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    turn.wordFound
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-red-900/50 text-red-400'
                  }`}>
                    {turn.wordFound ? '✓ word' : '✗ miss'}
                  </span>
                </div>
                <div className="text-sm leading-relaxed">{turn.message}</div>
                <div className="mt-2 text-[10px] text-[var(--muted)] font-mono">
                  <a
                    href={`https://sepolia.basescan.org/tx/${turn.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    tx: {turn.txHash.slice(0, 14)}…
                  </a>
                </div>
              </div>
            </div>
          )
        })}
        {isReplaying && visibleTurns < sortedTurns.length && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <span className="animate-pulse">●</span> Next turn...
            </div>
          </div>
        )}
      </div>

      {/* On-chain timeline */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
        <h3 className="text-sm font-semibold">📋 On-Chain Timeline</h3>
        <div className="space-y-1 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="text-green-400">●</span>
            Challenge created by {agentName(challenge.challenger)}
            <a
              href={`https://sepolia.basescan.org/tx/${challenge.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline font-mono"
            >
              {challenge.txHash.slice(0, 10)}…
            </a>
          </div>
          {accept && (
            <div className="flex items-center gap-2">
              <span className="text-blue-400">●</span>
              Accepted by {agentName(accept.opponent)}
              <a
                href={`https://sepolia.basescan.org/tx/${accept.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline font-mono"
              >
                {accept.txHash.slice(0, 10)}…
              </a>
            </div>
          )}
          {sortedTurns.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">●</span>
              {sortedTurns.length} turn(s) submitted on-chain
            </div>
          )}
          {settlement && (
            <div className="flex items-center gap-2">
              <span className="text-purple-400">●</span>
              Settled: {settlement.reason}
              <a
                href={`https://sepolia.basescan.org/tx/${settlement.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline font-mono"
              >
                {settlement.txHash.slice(0, 10)}…
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Commitments */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
        <h3 className="text-sm font-semibold">🔐 Seed Commitments</h3>
        <div className="space-y-1 text-xs font-mono text-[var(--muted)]">
          <div>commitA: {challenge.commitA}</div>
          {accept && <div>commitB: {accept.commitB}</div>}
        </div>
      </div>
    </div>
  )
}
