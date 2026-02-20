import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { formatEther } from 'viem'
import { agentName } from '../lib/format'
import { CONTRACTS } from '../config/wagmi'
import {
  useArenaChallenges,
  useArenaAccepts,
  useArenaTurns,
  useArenaSettlements,
  useArenaTiming,
  useArenaBattleCore,
} from '../hooks/useChain'
import { useWakuTurns } from '../hooks/useWakuTurns'

/**
 * Turn timer bar — shows who's up, time draining green→red, blinks near 0.
 * Sits below the last turn bubble, above "Waiting for next turn…"
 */
function TurnTimerBar({
  deadline,
  baseTimeout,
  currentTurn,
  whoseTurn,
  isChallenger,
}: {
  deadline: bigint
  baseTimeout: bigint
  currentTurn: number
  whoseTurn: `0x${string}`
  isChallenger: boolean
}) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000)
      setSecondsLeft(Math.max(0, Number(deadline) - now))
    }
    update()
    const id = setInterval(update, 500)
    return () => clearInterval(id)
  }, [deadline])

  // Turn timeout decreases linearly: base - (base/20)*(turn-1), floor MIN_TIMEOUT=5
  const turnTimeout = useMemo(() => {
    const base = Number(baseTimeout)
    if (currentTurn <= 1) return base
    const decrement = Math.floor(base / 20)
    const reduced = base - decrement * (currentTurn - 1)
    return Math.max(5, reduced)
  }, [baseTimeout, currentTurn])

  const pct = Math.max(0, Math.min(100, (secondsLeft / turnTimeout) * 100))
  const isCritical = secondsLeft < 10
  const isUrgent = secondsLeft < 30

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  // Color: green → yellow → orange → red
  const barColor = isCritical
    ? 'bg-red-500'
    : isUrgent
      ? 'bg-orange-500'
      : pct > 60
        ? 'bg-green-500'
        : 'bg-yellow-500'

  return (
    <div className={`mx-4 my-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 ${isCritical ? 'animate-pulse' : ''}`}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className={isChallenger ? 'text-red-400' : 'text-blue-400'}>
            {isChallenger ? '🗡️' : '🛡️'}
          </span>
          <span className="text-[var(--muted)]">Waiting for</span>
          <span className="font-medium text-[var(--fg)]">{agentName(whoseTurn)}</span>
          <span className="text-[var(--muted)]">· Turn {currentTurn}</span>
        </span>
        <span className={`font-mono font-bold tabular-nums ${
          isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-[var(--fg)]'
        }`}>
          ⏱ {timeStr}
        </span>
      </div>
      {/* Progress bar — drains left to right */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/arena/$id')({
  component: ArenaBattlePage,
})

function ArenaBattlePage() {
  const { id } = Route.useParams()
  const battleId = id as `0x${string}`

  const { data: challenges, isLoading: loadingC } = useArenaChallenges()
  const { data: accepts, isLoading: loadingA } = useArenaAccepts()
  const { data: settlements, isLoading: loadingS } = useArenaSettlements()

  // Determine if battle is live (accepted but not settled)
  const settlement = settlements?.find((s) => s.battleId === battleId)
  const accept = accepts?.find((a) => a.battleId === battleId)
  const isLive = !!accept && !settlement

  const { data: turns, isLoading: loadingT } = useArenaTurns(battleId, isLive)
  const { data: timing } = useArenaTiming(battleId, isLive)
  const { data: battleCore } = useArenaBattleCore(battleId, isLive)

  // Waku live subscription — near-instant turn delivery
  const { wakuTurns, connected: wakuConnected } = useWakuTurns({
    battleId,
    enabled: isLive,
  })

  const [visibleTurns, setVisibleTurns] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)
  const [prevTurnCount, setPrevTurnCount] = useState(0)

  const isLoading = loadingC || loadingA || loadingT || loadingS

  const challenge = challenges?.find((c) => c.battleId === battleId)

  // Merge on-chain turns with Waku turns (dedup by turnNumber, on-chain wins)
  const sortedTurns = useMemo(() => {
    const onChain = turns ?? []
    const merged = [...onChain]
    for (const wt of wakuTurns) {
      if (!merged.some(t => t.turnNumber === wt.turnNumber)) {
        merged.push(wt)
      }
    }
    return merged.sort((a, b) => a.turnNumber - b.turnNumber)
  }, [turns, wakuTurns])

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

  // Auto-append new turns during live battles
  useEffect(() => {
    if (isLive && sortedTurns.length > prevTurnCount && !isReplaying) {
      setVisibleTurns(sortedTurns.length)
    }
    setPrevTurnCount(sortedTurns.length)
  }, [sortedTurns.length, isLive])

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
        {isLive && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/50 px-3 py-1 text-xs font-medium text-red-400">
            <span className="animate-pulse">●</span> LIVE
            {wakuConnected && (
              <span className="text-[10px] text-green-400 ml-1" title="Waku P2P connected">⚡</span>
            )}
          </span>
        )}
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
        {isLive && !isReplaying && visibleTurns >= sortedTurns.length && (() => {
          // Determine whose turn it is
          const turnNum = battleCore?.currentTurn ?? sortedTurns.length + 1
          const isEvenTurn = turnNum % 2 === 0
          // Turn 1 = challenger, turn 2 = opponent, alternating
          const whoseTurn = challenge
            ? (isEvenTurn ? accept?.opponent : challenge.challenger) ?? challenge.challenger
            : null

          if (timing && timing.turnDeadline > 0n && whoseTurn && battleCore) {
            const isChallenger = whoseTurn.toLowerCase() === challenge?.challenger.toLowerCase()
            return (
              <TurnTimerBar
                deadline={timing.turnDeadline}
                baseTimeout={timing.baseTimeout}
                currentTurn={turnNum}
                whoseTurn={whoseTurn}
                isChallenger={isChallenger}
              />
            )
          }

          // Fallback if timing not yet loaded
          return (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <span className="animate-pulse text-red-400">●</span> Waiting for next turn…
              </div>
            </div>
          )
        })()}
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
