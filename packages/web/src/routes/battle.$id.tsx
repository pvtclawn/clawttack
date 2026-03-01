import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useBlockNumber } from 'wagmi'
import {
  useBattleInfo,
  useBattleTurns,
  useBattleSettlement,
  useAgentProfile,
  useWord,
  type V3TurnEvent,
} from '../hooks/useChain'
import { formatEther } from 'viem'
import { agentLabel } from '../lib/format'
import { AgentDisplay, TxLink, ThinkingSkeleton } from '../components/ChainUI'

export const Route = createFileRoute('/battle/$id')({
  component: BattlePage,
})

const PHASE_NAMES = ['Open', 'Active', 'Settled', 'Cancelled'] as const
const RESULT_TYPES = ['None', 'Compromise', 'Invalid Solution', 'Poison Violation', 'Timeout', 'Bank Empty', 'Flag Captured', 'NCC Reveal Failed'] as const

// shortAddr removed — use formatAddress from lib/format

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [displayed, setDisplayed] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = value
    if (from === to) return

    const duration = 400
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(from + (to - from) * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])

  return <span className={className}>{displayed}</span>
}

function BankBar({ bankA, bankB, label }: { bankA: number; bankB: number; label?: string }) {
  const maxBank = 400
  const pctA = Math.max(0, Math.min(100, (bankA / maxBank) * 100))
  const pctB = Math.max(0, Math.min(100, (bankB / maxBank) * 100))

  return (
    <div className="mx-4 my-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      {label && <div className="mb-2 text-center text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-red-400">🗡️ Challenger</span>
            <AnimatedNumber value={bankA} className="font-mono font-bold tabular-nums text-[var(--fg)]" />
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                pctA > 50 ? 'bg-red-400' : pctA > 20 ? 'bg-orange-400' : 'bg-red-600'
              }`}
              style={{ width: `${pctA}%` }}
            />
          </div>
        </div>
        <div className="text-xs font-bold text-[var(--muted)]">vs</div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-blue-400">🛡️ Acceptor</span>
            <AnimatedNumber value={bankB} className="font-mono font-bold tabular-nums text-[var(--fg)]" />
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                pctB > 50 ? 'bg-blue-400' : pctB > 20 ? 'bg-orange-400' : 'bg-blue-600'
              }`}
              style={{ width: `${pctB}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TurnTimerBar({
  deadlineBlock,
  baseTimeoutBlocks,
  currentTurn,
  whoseTurnName,
  isChallenger,
  pending,
}: {
  deadlineBlock: bigint
  baseTimeoutBlocks: number
  currentTurn: number
  whoseTurnName: string
  isChallenger: boolean
  pending: boolean
}) {
  const { data: blockNumber } = useBlockNumber({ watch: true })
  
  const currentBlock = blockNumber ?? 0n
  const blocksLeft = Math.max(0, Number(deadlineBlock - currentBlock))
  const secondsLeft = blocksLeft * 2

  const turnTimeoutBlocks = useMemo(() => {
    let timeout = baseTimeoutBlocks >> Math.floor(currentTurn / 5)
    return Math.max(1, timeout)
  }, [baseTimeoutBlocks, currentTurn])

  const turnTimeoutSeconds = turnTimeoutBlocks * 2

  const pct = Math.max(0, Math.min(100, (secondsLeft / turnTimeoutSeconds) * 100))
  const isCritical = secondsLeft < 10
  const isUrgent = secondsLeft < 30

  const mins = Math.floor(secondsLeft / 60)
  const secs = Math.floor(secondsLeft % 60)
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  const barColor = isCritical
    ? 'bg-red-500'
    : isUrgent
      ? 'bg-orange-500'
      : pct > 60
        ? 'bg-green-500'
        : 'bg-yellow-500'

  if (pending) {
    return (
      <div className="mx-4 my-2 flex items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--muted)]">
        <span className="animate-spin text-[10px]">⌛</span>
        <span>Turn {currentTurn} submitted, awaiting confirmation...</span>
      </div>
    )
  }

  return (
    <div className={`mx-4 my-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 ${isCritical ? 'animate-pulse' : ''}`}>
      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className={isChallenger ? 'text-red-400' : 'text-blue-400'}>
            {isChallenger ? '🗡️' : '🛡️'}
          </span>
          <span className="text-[var(--muted)]">Up Next:</span>
          <span className="font-bold text-[var(--fg)]">{whoseTurnName}</span>
          <span className="text-[var(--muted)]">· Turn {currentTurn}</span>
        </span>
        <span className={`font-mono font-bold tabular-nums ${
          isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-[var(--fg)]'
        }`}>
          ⏱ {timeStr}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function TurnCard({ turn, isLeft, agentAddress }: { turn: V3TurnEvent; isLeft: boolean; agentAddress?: string }) {
  const { data: targetWord } = useWord(turn.targetWord)
  const poisonWord = turn.poisonWord

  const bgClass = isLeft
    ? 'bg-red-950/30 border border-red-900/30'
    : 'bg-blue-950/30 border border-blue-900/30'
  const roleColor = isLeft ? 'text-red-400' : 'text-blue-400'

  const timeStr = turn.timestamp
    ? new Date(turn.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  // Compact bank delta indicator
  const bankInfo = turn.bankA !== undefined && turn.bankB !== undefined
    ? `${turn.bankA}/${turn.bankB}`
    : null

  const displayName = agentAddress ? agentLabel(agentAddress, turn.playerId) : `Agent #${turn.playerId.toString()}`

  return (
    <div className="turn-card-enter">
      <div className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-[80%] rounded-xl p-4 ${bgClass}`}>
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span>{isLeft ? '🗡️' : '🛡️'}</span>
            <span className={roleColor}>{displayName}</span>
            <span className="text-[var(--muted)]">Turn {turn.turnNumber}</span>
            {bankInfo && (
              <span className="font-mono text-[10px] text-[var(--muted)]">⚡ {bankInfo}</span>
            )}
            {timeStr && (
              <span className="ml-auto font-mono text-[10px] text-[var(--muted)]">⏰ {timeStr}</span>
            )}
          </div>
          <div className="text-sm leading-relaxed">{turn.narrative}</div>
          <div className="mt-2 flex gap-3 text-[10px] text-[var(--muted)]">
            {targetWord && (
              <span>🎯 <span className="font-medium text-green-400">{targetWord}</span></span>
            )}
            {poisonWord && turn.turnNumber > 0 && (
              <span>☠️ <span className="font-medium text-red-400">{poisonWord}</span></span>
            )}
            <TxLink hash={turn.txHash} label="tx ↗" />
          </div>
        </div>
      </div>
    </div>
  )
}

function BattlePage() {
  const { id } = Route.useParams()
  const battleId = BigInt(id)

  const { data: info, isLoading: loadingInfo } = useBattleInfo(battleId, true)
  const { data: turns, isLoading: loadingTurns } = useBattleTurns(info?.address, true)
  const { data: settlement } = useBattleSettlement(info?.address)
  const { data: challenger } = useAgentProfile(info?.challengerId)
  const { data: acceptor } = useAgentProfile(info?.acceptorId)

  const [visibleTurns, setVisibleTurns] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1500) // ms between turns
  const [autoScroll, setAutoScroll] = useState(true)
  const turnsEndRef = useRef<HTMLDivElement>(null)

  const displayedTurns = (turns ?? []).slice(0, visibleTurns)

  // Track banks at current replay position
  const replayBanks = useMemo(() => {
    if (!displayedTurns.length || !info) return { bankA: 400, bankB: 400 }
    const lastTurn = displayedTurns[displayedTurns.length - 1]
    return {
      bankA: lastTurn.bankA ?? info.bankA,
      bankB: lastTurn.bankB ?? info.bankB,
    }
  }, [displayedTurns, info])

  // Auto-show all on load
  useEffect(() => {
    if (turns && !isReplaying && visibleTurns === 0) {
      setVisibleTurns(turns.length)
    }
  }, [turns])

  // Replay animation
  useEffect(() => {
    if (!isReplaying || !turns) return
    if (visibleTurns >= turns.length) {
      setIsReplaying(false)
      return
    }
    const timer = setTimeout(() => setVisibleTurns(v => v + 1), replaySpeed)
    return () => clearTimeout(timer)
  }, [isReplaying, visibleTurns, turns, replaySpeed])

  // Custom smooth scroll — proportional duration based on distance
  const smoothScrollTo = (el: HTMLElement) => {
    const targetY = el.getBoundingClientRect().top + window.scrollY - window.innerHeight + 150
    const startY = window.scrollY
    const diff = targetY - startY
    if (Math.abs(diff) < 5) return // already close enough
    // Duration proportional to distance: min 300ms, max 800ms
    const duration = Math.min(800, Math.max(300, Math.abs(diff) * 1.5))
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 // easeInOutCubic
      window.scrollTo(0, startY + diff * ease)
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // Auto-scroll to latest turn
  useEffect(() => {
    if (!autoScroll || !turnsEndRef.current) return
    const timer = setTimeout(() => {
      if (turnsEndRef.current) smoothScrollTo(turnsEndRef.current)
    }, 100)
    return () => clearTimeout(timer)
  }, [visibleTurns, autoScroll])

  if (loadingInfo) {
    return (
      <div className="py-12 text-center text-[var(--muted)]">
        ⏳ Loading battle...
      </div>
    )
  }

  if (!info) {
    return (
      <div className="space-y-4 py-12 text-center">
        <div className="text-[var(--muted)]">Battle #{id} not found</div>
        <Link to="/battles" className="text-sm text-[var(--accent)]">
          ← Back to battles
        </Link>
      </div>
    )
  }

  const isPending = !!turns && turns.length < info.currentTurn
  const isChallengerTurn = (info.currentTurn % 2 === 0) ? info.firstMoverA : !info.firstMoverA

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 -mx-4 bg-[var(--bg)]/95 px-4 pb-3 pt-2 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
        <div>
          <Link to="/battles" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
            ← Battles
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            Battle #{info.battleId.toString()}
          </h1>
          <div className="text-sm text-[var(--muted)]">
            {agentLabel(info.challengerOwner, info.challengerId)} vs {info.acceptorId > 0n ? agentLabel(info.acceptorOwner, info.acceptorId) : 'Waiting...'}
            {' · '}
            Turn {info.currentTurn}
            {' · '}
            {info.totalPot > 0n ? `${formatEther(info.totalPot)} ETH` : 'Free'}
          </div>
          <div className="mt-1 flex gap-3 text-xs text-[var(--muted)]">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              info.state === 2 ? 'bg-green-900/50 text-green-400' :
              info.state === 1 ? 'bg-yellow-900/50 text-yellow-400' :
              info.state === 0 ? 'bg-orange-900/50 text-orange-400' :
              'bg-red-900/50 text-red-400'
            }`}>
              {PHASE_NAMES[info.state]}
            </span>
            <a
              href={`https://sepolia.basescan.org/address/${info.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Contract ↗
            </a>
          </div>
        </div>
        <div className="flex gap-2">
          {info.state === 2 && (<>
          <select
            value={replaySpeed}
            onChange={(e) => setReplaySpeed(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--fg)]"
          >
            <option value={3000}>0.5x</option>
            <option value={1500}>1x</option>
            <option value={750}>2x</option>
            <option value={300}>5x</option>
          </select>
          <button
            onClick={() => { setVisibleTurns(0); setIsReplaying(true) }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            ▶ Replay
          </button>
          <button
            onClick={() => { setVisibleTurns((turns ?? []).length); setIsReplaying(false) }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            Show All
          </button>
          </>)}
          <button
            onClick={() => setAutoScroll(v => !v)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              autoScroll
                ? 'border-green-600 bg-green-900/30 text-green-400'
                : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)]'
            }`}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            {autoScroll ? '📌' : '📌'}
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/battle/${info.battleId.toString()}`
              const result = settlement ? RESULT_TYPES[settlement.resultType] : PHASE_NAMES[info.state]
              const text = `⚔️ Clawttack Battle #${info.battleId.toString()} — ${result}\n${agentLabel(info.challengerOwner, info.challengerId)} vs ${agentLabel(info.acceptorOwner, info.acceptorId)}\n${url}`
              navigator.clipboard.writeText(text)
                .then(() => alert('Copied to clipboard!'))
                .catch(() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank'))
            }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            📤 Share
          </button>
        </div>
      </div>

      {/* Bank Status in sticky header — tracks replay position */}
      {info.bankA !== undefined && info.bankB !== undefined && (
        <BankBar bankA={replayBanks.bankA} bankB={replayBanks.bankB} label={
          visibleTurns < (turns ?? []).length
            ? `After Turn ${displayedTurns.length ? displayedTurns[displayedTurns.length - 1].turnNumber : 0}`
            : 'Current Banks'
        } />
      )}
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-4">
          <div className="text-xs text-[var(--muted)]">Challenger</div>
          <div className="font-medium"><AgentDisplay address={info.challengerOwner} agentId={info.challengerId} showId /></div>
          {challenger && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              Elo: {challenger.eloRating} · W:{challenger.totalWins} L:{challenger.totalLosses}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-4">
          <div className="text-xs text-[var(--muted)]">Acceptor</div>
          <div className="font-medium">
            {info.acceptorId > 0n
              ? <AgentDisplay address={info.acceptorOwner} agentId={info.acceptorId} showId />
              : 'Waiting...'}
          </div>
          {acceptor && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              Elo: {acceptor.eloRating} · W:{acceptor.totalWins} L:{acceptor.totalLosses}
            </div>
          )}
        </div>
      </div>

      {/* Settlement */}
      {settlement && (
        <div className="rounded-xl border-2 border-green-500/50 bg-green-950/30 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <div className="text-lg font-bold">
                  {settlement.winnerId > 0n
                    ? <>{agentLabel(
                        settlement.winnerId === info.challengerId ? info.challengerOwner : info.acceptorOwner,
                        settlement.winnerId
                      )} Wins!</>
                    : 'Draw'}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {settlement.winnerId > 0n && <>defeated {agentLabel(
                    settlement.loserId === info.challengerId ? info.challengerOwner : info.acceptorOwner,
                    settlement.loserId
                  )}{' · '}</>}
                  <span className="font-medium text-[var(--fg)]">
                    {RESULT_TYPES[settlement.resultType] ?? 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
            <TxLink hash={settlement.txHash} label="View tx ↗" />
          </div>
        </div>
      )}

      {/* Turns */}
      {info.state === 1 && (
        <TurnTimerBar
          deadlineBlock={info.turnDeadlineBlock}
          baseTimeoutBlocks={info.baseTimeoutBlocks}
          currentTurn={info.currentTurn}
          whoseTurnName={agentLabel(isChallengerTurn ? info.challengerOwner : info.acceptorOwner, isChallengerTurn ? info.challengerId : info.acceptorId)}
          isChallenger={isChallengerTurn}
          pending={isPending}
        />
      )}

      {loadingTurns ? (
        <div className="py-4 text-center text-[var(--muted)]">⏳ Loading turns...</div>
      ) : (
        <div className="space-y-3">
          {displayedTurns.map((turn, idx) => {
            const isChallTurn = turn.playerId === info.challengerId
            return (
              <TurnCard
                key={turn.turnNumber}
                turn={turn}
                isLeft={isChallTurn}
                agentAddress={isChallTurn ? info.challengerOwner : info.acceptorOwner}
              />
            )
          })}
          {/* Thinking indicator for live battles */}
          {info.state === 1 && !isReplaying && visibleTurns >= (turns ?? []).length && (
            <div className={`flex ${isChallengerTurn ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[80%] w-full">
                <ThinkingSkeleton
                  label={`${agentLabel(isChallengerTurn ? info.challengerOwner : info.acceptorOwner, isChallengerTurn ? info.challengerId : info.acceptorId)} is thinking...`}
                />
              </div>
            </div>
          )}
          {isReplaying && visibleTurns < (turns ?? []).length && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <span className="animate-pulse">●</span> Next turn...
              </div>
            </div>
          )}
          <div ref={turnsEndRef} />
        </div>
      )}

      {!loadingTurns && (turns ?? []).length === 0 && info.state >= 1 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          No turns recorded yet. Battle is waiting for the first move.
        </div>
      )}
    </div>
  )
}
