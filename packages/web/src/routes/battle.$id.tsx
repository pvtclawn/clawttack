import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useBlockNumber } from 'wagmi'
import {
  useBattleInfo,
  useBattleTurns,
  useBattleSettlement,
  useAgentProfile,
  useWord,
  type TurnEvent,
} from '../hooks/useChain'
import { formatEther } from 'viem'
import { agentLabel, explorerUrl, copyToClipboard, formatAddress, blocksToSeconds } from '../lib/format'
import { buildBattleTranscriptExport, battleTranscriptFilename, downloadJsonFile } from '../lib/battle-export'
import { AgentDisplay, TxLink, ThinkingSkeleton } from '../components/ChainUI'
import {
  Swords, Shield, Play, Square, Pin, PinOff, Share2, ExternalLink, Copy, Check,
  Trophy, Crown, Skull, Clock, Zap, Target, ChevronLeft, Download,
} from 'lucide-react'

export const Route = createFileRoute('/battle/$id')({
  component: BattlePage,
})

const PHASE_NAMES = ['Open', 'Active', 'Settled', 'Cancelled'] as const
const RESULT_TYPES = ['None', 'Compromise', 'Invalid Solution', 'Poison Violation', 'Timeout', 'Bank Empty', 'NCC Reveal Failed', 'VOP Reveal Failed'] as const

// ─── Utility: copy with brief ✓ feedback ─────────────────────────────────────
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => { e.preventDefault(); copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`inline-flex items-center ${className ?? 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
      title="Copy"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  )
}

// ─── Animated number ─────────────────────────────────────────────────────────
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
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(from + (to - from) * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])

  return <span className={className}>{displayed}</span>
}

// ─── Bank Bar (shared by live + replay) ──────────────────────────────────────
function BankBar({
  bankA, bankB, label,
  drainBlocks, isChallengerDraining,
  challengerName, acceptorName,
}: {
  bankA: number; bankB: number; label?: string
  drainBlocks?: number; isChallengerDraining?: boolean
  challengerName?: string; acceptorName?: string
}) {
  const maxBank = 400
  const drain = drainBlocks ?? 0
  const cappedDrain = Math.min(drain, 80) // MAX_TURN_TIMEOUT cap
  const drainSecs = blocksToSeconds(cappedDrain)
  const projA = isChallengerDraining ? Math.max(0, bankA - cappedDrain) : bankA
  const projB = !isChallengerDraining ? Math.max(0, bankB - cappedDrain) : bankB
  const pctA = Math.max(0, Math.min(100, (projA / maxBank) * 100))
  const pctB = Math.max(0, Math.min(100, (projB / maxBank) * 100))

  return (
    <div className="mx-4 my-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      {label && <div className="mb-2 text-center text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>}
      <div className="flex items-center gap-3">
        {/* Challenger */}
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-red-400">
              <Swords size={10} /> {challengerName ?? 'Challenger'}
            </span>
            <span className="inline-flex items-center gap-1">
              <AnimatedNumber value={projA} className="font-mono font-bold tabular-nums text-[var(--fg)]" />
              {isChallengerDraining && cappedDrain > 0 && (
                <span className="font-mono text-red-400 animate-pulse text-[10px]">
                  -{cappedDrain} <span className="text-[var(--muted)]">({drainSecs}s)</span>
                </span>
              )}
            </span>
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
        {/* Acceptor */}
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-blue-400">
              <Shield size={10} /> {acceptorName ?? 'Acceptor'}
            </span>
            <span className="inline-flex items-center gap-1">
              <AnimatedNumber value={projB} className="font-mono font-bold tabular-nums text-[var(--fg)]" />
              {!isChallengerDraining && cappedDrain > 0 && (
                <span className="font-mono text-blue-400 animate-pulse text-[10px]">
                  -{cappedDrain} <span className="text-[var(--muted)]">({drainSecs}s)</span>
                </span>
              )}
            </span>
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

// ─── Confetti Canvas ─────────────────────────────────────────────────────────
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#e056fd', '#7bed9f', '#ff9ff3']
    const particles: Array<{
      x: number; y: number; vx: number; vy: number
      w: number; h: number; color: string; rotation: number
      rotSpeed: number; opacity: number
    }> = []

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width * Math.random(),
        y: -20 - Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      })
    }

    let frame = 0
    const maxFrames = 180

    const animate = () => {
      frame++
      if (frame > maxFrames) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const fadeStart = maxFrames * 0.6
      const globalFade = frame > fadeStart ? 1 - (frame - fadeStart) / (maxFrames - fadeStart) : 1

      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.05
        p.y += p.vy
        p.vx *= 0.99
        p.rotation += p.rotSpeed
        p.opacity = globalFade

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      requestAnimationFrame(animate)
    }

    animate()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// ─── Winner Banner ───────────────────────────────────────────────────────────
function WinnerBanner({
  winnerName, loserName, resultType, txHash, show,
}: {
  winnerName: string; loserName: string; resultType: string; txHash: string; show: boolean
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), 300)
      return () => clearTimeout(t)
    }
    setVisible(false)
  }, [show])

  if (!show) return null

  return (
    <div className="relative overflow-hidden">
      {visible && <ConfettiCanvas />}
      <div
        className={`relative z-10 mx-4 my-2 rounded-xl border-2 border-yellow-500/60 bg-gradient-to-r from-yellow-950/40 via-amber-950/30 to-yellow-950/40 p-4 transition-all duration-700 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400 drop-shadow-lg" size={28} />
            <div>
              <div className="text-lg font-bold text-yellow-300">
                {winnerName} Wins!
              </div>
              <div className="text-sm text-yellow-200/70">
                defeated {loserName} · <span className="font-medium text-yellow-200">{resultType}</span>
              </div>
            </div>
          </div>
          <TxLink hash={txHash} label="View tx ↗" />
        </div>
      </div>
    </div>
  )
}

// ─── Turn Card ───────────────────────────────────────────────────────────────
function TurnCard({
  turn, isLeft, agentAddress, isWinner,
}: {
  turn: TurnEvent; isLeft: boolean; agentAddress?: string; isWinner?: boolean
}) {
  const { data: targetWord } = useWord(turn.targetWord)
  const poisonWord = turn.poisonWord

  const bgClass = isWinner
    ? isLeft
      ? 'bg-red-950/30 border border-yellow-700/40 shadow-[0_0_12px_rgba(234,179,8,0.08)]'
      : 'bg-blue-950/30 border border-yellow-700/40 shadow-[0_0_12px_rgba(234,179,8,0.08)]'
    : isLeft
      ? 'bg-red-950/30 border border-red-900/30'
      : 'bg-blue-950/30 border border-blue-900/30'
  const roleColor = isLeft ? 'text-red-400' : 'text-blue-400'

  const timeStr = turn.timestamp
    ? new Date(turn.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const bankInfo = turn.bankA !== undefined && turn.bankB !== undefined
    ? `${turn.bankA}/${turn.bankB}`
    : null

  const displayName = agentAddress ? agentLabel(agentAddress, turn.playerId) : `Agent #${turn.playerId.toString()}`

  return (
    <div className="turn-card-enter">
      <div className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-[80%] rounded-xl p-4 ${bgClass}`}>
          <div className="mb-1 flex items-center gap-2 text-xs">
            {isLeft
              ? <Swords size={12} className="text-red-400" />
              : <Shield size={12} className="text-blue-400" />
            }
            <span className={roleColor}>{displayName}</span>
            {isWinner && <Crown size={10} className="text-yellow-500" />}
            <span className="text-[var(--muted)]">Turn {turn.turnNumber}</span>
            {bankInfo && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-[var(--muted)]">
                <Zap size={8} /> {bankInfo}
              </span>
            )}
            {timeStr && (
              <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-[10px] text-[var(--muted)]">
                <Clock size={8} /> {timeStr}
              </span>
            )}
          </div>
          <div className="text-sm leading-relaxed">{turn.narrative}</div>
          <div className="mt-2 flex gap-3 text-[10px] text-[var(--muted)]">
            {targetWord && (
              <span className="inline-flex items-center gap-0.5">
                <Target size={8} className="text-green-400" /> <span className="font-medium text-green-400">{targetWord}</span>
              </span>
            )}
            {poisonWord && turn.turnNumber > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Skull size={8} className="text-red-400" /> <span className="font-medium text-red-400">{poisonWord}</span>
              </span>
            )}
            <TxLink hash={turn.txHash} label="tx ↗" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Replay drain simulation hook ────────────────────────────────────────────
// Simulates elapsed blocks ticking up between turns during replay
function useReplayDrain(isReplaying: boolean, displayedTurns: TurnEvent[], turns: TurnEvent[] | undefined) {
  const [simElapsed, setSimElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isReplaying || !turns || !displayedTurns.length) {
      setSimElapsed(0)
      return
    }

    // Calculate how many blocks the NEXT turn will take
    const lastIdx = displayedTurns.length - 1
    const lastTurn = displayedTurns[lastIdx]
    const nextTurn = turns[displayedTurns.length]
    const realElapsed = nextTurn
      ? Number(nextTurn.blockNumber - lastTurn.blockNumber)
      : 10 // default estimate

    // Tick up simulated elapsed every 2s (1 Base block = 2s)
    setSimElapsed(0)
    const interval = setInterval(() => {
      setSimElapsed(prev => {
        const next = prev + 1
        return next >= Math.min(realElapsed, 80) ? Math.min(realElapsed, 80) : next
      })
    }, 2000)
    intervalRef.current = interval
    return () => clearInterval(interval)
  }, [isReplaying, displayedTurns.length, turns])

  return simElapsed
}

// ─── Battle Page ─────────────────────────────────────────────────────────────
function BattlePage() {
  const { id } = Route.useParams()
  const battleId = BigInt(id)

  const { data: info, isLoading: loadingInfo } = useBattleInfo(battleId, true)
  const { data: turns, isLoading: loadingTurns } = useBattleTurns(info?.address, true)
  const { data: settlement } = useBattleSettlement(info?.address)
  const { data: challenger } = useAgentProfile(info?.challengerId)
  const { data: acceptor } = useAgentProfile(info?.acceptorId)
  const { data: currentBlockNumber } = useBlockNumber({ watch: true })

  const [visibleTurns, setVisibleTurns] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1500)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showSettlement, setShowSettlement] = useState(false)
  const turnsEndRef = useRef<HTMLDivElement>(null)

  const displayedTurns = (turns ?? []).slice(0, visibleTurns)

  const replayBanks = useMemo(() => {
    if (!displayedTurns.length || !info) return { bankA: 400, bankB: 400 }
    
    if (info.state === 2 && displayedTurns.length === turns?.length) {
      return {
        bankA: info.bankA,
        bankB: info.bankB,
      }
    }

    const lastTurn = displayedTurns[displayedTurns.length - 1]
    return {
      bankA: lastTurn.bankA ?? info.bankA,
      bankB: lastTurn.bankB ?? info.bankB,
    }
  }, [displayedTurns, info, turns])

  // ─── Unified drain logic ────────────────────────────────────────────
  // Live: real elapsed blocks from chain
  // Replay: simulated elapsed blocks ticking up between turns
  const replayDrain = useReplayDrain(isReplaying, displayedTurns, turns)

  const liveDrain = useMemo(() => {
    if (!turns?.length || !currentBlockNumber) return 0
    const lastTurnBn = turns[turns.length - 1].blockNumber
    return Number(currentBlockNumber - lastTurnBn)
  }, [turns, currentBlockNumber])

  const isLive = !!(info && info.state === 1 && !isReplaying && visibleTurns >= (turns ?? []).length)
  const drainBlocks = isLive ? liveDrain : isReplaying ? replayDrain : 0

  // ─── Auto-show & replay ──────────────────────────────────────────────
  useEffect(() => {
    if (turns && !isReplaying) {
      if (visibleTurns === 0) {
        setVisibleTurns(turns.length)
        if (settlement) setShowSettlement(true)
      } else if (turns.length > visibleTurns) {
        setVisibleTurns(turns.length)
      }
    }
  }, [turns, settlement])

  useEffect(() => {
    if (!isReplaying || !turns) return
    if (visibleTurns >= turns.length) {
      if (settlement) {
        const timer = setTimeout(() => {
          setShowSettlement(true)
          setIsReplaying(false)
        }, replaySpeed * 1.5)
        return () => clearTimeout(timer)
      }
      setIsReplaying(false)
      return
    }
    const timer = setTimeout(() => setVisibleTurns(v => v + 1), replaySpeed)
    return () => clearTimeout(timer)
  }, [isReplaying, visibleTurns, turns, replaySpeed, settlement])

  // ─── Scroll ──────────────────────────────────────────────────────────
  const smoothScrollTo = useCallback((el: HTMLElement) => {
    const targetY = el.getBoundingClientRect().top + window.scrollY - window.innerHeight + 150
    const startY = window.scrollY
    const diff = targetY - startY
    if (Math.abs(diff) < 5) return
    const duration = Math.min(800, Math.max(300, Math.abs(diff) * 1.5))
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      window.scrollTo(0, startY + diff * ease)
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    if (!autoScroll || !turnsEndRef.current) return
    const timer = setTimeout(() => {
      if (turnsEndRef.current) smoothScrollTo(turnsEndRef.current)
    }, 100)
    return () => clearTimeout(timer)
  }, [visibleTurns, autoScroll, showSettlement, smoothScrollTo])

  // ─── Loading / Not found ─────────────────────────────────────────────
  if (loadingInfo) {
    return <div className="py-12 text-center text-[var(--muted)]">⏳ Loading battle...</div>
  }

  if (!info) {
    return (
      <div className="space-y-4 py-12 text-center">
        <div className="text-[var(--muted)]">Battle #{id} not found</div>
        <Link to="/battles" className="text-sm text-[var(--accent)]">← Back to battles</Link>
      </div>
    )
  }

  // ─── Derived state ──────────────────────────────────────────────────
  const lastDisplayed = displayedTurns[displayedTurns.length - 1]
  const nextTurnIsChallenger = lastDisplayed
    ? lastDisplayed.playerId !== info.challengerId
    : info.firstMoverA
  const nextTurnAddr = nextTurnIsChallenger ? info.challengerOwner : info.acceptorOwner
  const nextTurnId = nextTurnIsChallenger ? info.challengerId : info.acceptorId

  const winnerId = settlement?.winnerId
  const showSkeleton = (isReplaying && visibleTurns < (turns ?? []).length) || isLive
  const settlementRevealed = settlement && showSettlement

  const winnerName = winnerId
    ? agentLabel(winnerId === info.challengerId ? info.challengerOwner : info.acceptorOwner, winnerId)
    : ''
  const loserName = settlement
    ? agentLabel(settlement.loserId === info.challengerId ? info.challengerOwner : info.acceptorOwner, settlement.loserId)
    : ''

  const displayTurn = isReplaying
    ? (lastDisplayed?.turnNumber ?? 0)
    : info.currentTurn

  const challengerName = agentLabel(info.challengerOwner, info.challengerId)
  const acceptorName = agentLabel(info.acceptorOwner, info.acceptorId)

  // ─── Handlers ────────────────────────────────────────────────────────
  const toggleReplay = () => {
    if (isReplaying) {
      // Stop — show everything
      setVisibleTurns((turns ?? []).length)
      setShowSettlement(!!settlement)
      setIsReplaying(false)
    } else {
      // Start replay from beginning
      setVisibleTurns(0)
      setShowSettlement(false)
      setIsReplaying(true)
    }
  }

  const showAll = () => {
    setVisibleTurns((turns ?? []).length)
    setShowSettlement(!!settlement)
    setIsReplaying(false)
  }

  const downloadTranscript = () => {
    const transcript = buildBattleTranscriptExport({
      origin: window.location.origin,
      info,
      turns: turns ?? [],
      settlement,
      challengerName,
      acceptorName,
    })
    downloadJsonFile(battleTranscriptFilename(info.battleId), transcript)
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 -mx-4 bg-[var(--bg)]/95 px-4 pb-3 pt-2 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/battles" className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]">
              <ChevronLeft size={12} /> Battles
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <span>Battle #{info.battleId.toString()}</span>
              <a
                href={explorerUrl('address', info.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--muted)] hover:text-[var(--accent)]"
                title="View contract"
              >
                <ExternalLink size={14} />
              </a>
              <CopyButton text={info.address} />
            </h1>
            <div className="text-sm text-[var(--muted)]">
              {challengerName} vs {info.acceptorId > 0n ? acceptorName : 'Waiting...'}
              {' · '}Turn {displayTurn}
              {' · '}{info.totalPot > 0n ? `${formatEther(info.totalPot)} ETH` : 'Free'}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-[var(--muted)]">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                info.state === 2 ? 'bg-green-900/50 text-green-400' :
                info.state === 1 ? 'bg-yellow-900/50 text-yellow-400' :
                info.state === 0 ? 'bg-orange-900/50 text-orange-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {isLive ? '🔴 Live' : PHASE_NAMES[info.state]}
              </span>
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
                onClick={toggleReplay}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm ${
                  isReplaying
                    ? 'border-red-600 bg-red-900/30 text-red-400'
                    : 'border-[var(--border)] hover:bg-[var(--surface)]'
                }`}
              >
                {isReplaying ? <><Square size={14} /> Stop</> : <><Play size={14} /> Replay</>}
              </button>
              {!isReplaying && (
                <button
                  onClick={showAll}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
                >
                  Show All
                </button>
              )}
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
              {autoScroll ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
            <button
              onClick={downloadTranscript}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
              title="Download full battle transcript as JSON"
            >
              <Download size={14} /> Transcript
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/battle/${info.battleId.toString()}`
                const result = settlement ? RESULT_TYPES[settlement.resultType] : PHASE_NAMES[info.state]
                const text = `⚔️ Clawttack Battle #${info.battleId.toString()} — ${result}\n${challengerName} vs ${acceptorName}\n${url}`
                copyToClipboard(text).then(() => alert('Copied to clipboard!'))
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {/* Bank Bar — unified for live + replay */}
        {info.bankA !== undefined && info.bankB !== undefined && (
          <BankBar
            bankA={replayBanks.bankA}
            bankB={replayBanks.bankB}
            label={
              isReplaying
                ? `Turn ${lastDisplayed?.turnNumber ?? 0} of ${info.currentTurn}`
                : isLive ? '🔴 LIVE' : 'Final Banks'
            }
            drainBlocks={drainBlocks}
            isChallengerDraining={nextTurnIsChallenger}
            challengerName={challengerName}
            acceptorName={acceptorName}
          />
        )}

        {/* Winner Banner */}
        {settlementRevealed && winnerId && winnerId > 0n && (
          <WinnerBanner
            winnerName={winnerName}
            loserName={loserName}
            resultType={RESULT_TYPES[settlement.resultType] ?? 'Unknown'}
            txHash={settlement.txHash}
            show={true}
          />
        )}
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-xl border p-4 ${
          winnerId === info.challengerId ? 'border-yellow-700/40 bg-yellow-950/10' : 'border-red-900/30 bg-red-950/20'
        }`}>
          <div className="text-xs text-[var(--muted)]">Challenger</div>
          <div className="font-medium">
            <AgentDisplay address={info.challengerOwner} agentId={info.challengerId} showId />
            {winnerId === info.challengerId && <Crown size={14} className="ml-2 inline text-yellow-500" />}
          </div>
          {challenger && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              Elo: {challenger.eloRating} · W:{challenger.totalWins} L:{challenger.totalLosses}
            </div>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${
          winnerId === info.acceptorId ? 'border-yellow-700/40 bg-yellow-950/10' : 'border-blue-900/30 bg-blue-950/20'
        }`}>
          <div className="text-xs text-[var(--muted)]">Acceptor</div>
          <div className="font-medium">
            {info.acceptorId > 0n
              ? <>
                  <AgentDisplay address={info.acceptorOwner} agentId={info.acceptorId} showId />
                  {winnerId === info.acceptorId && <Crown size={14} className="ml-2 inline text-yellow-500" />}
                </>
              : 'Waiting...'}
          </div>
          {acceptor && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              Elo: {acceptor.eloRating} · W:{acceptor.totalWins} L:{acceptor.totalLosses}
            </div>
          )}
        </div>
      </div>

      {/* Turns */}
      {loadingTurns ? (
        <div className="py-4 text-center text-[var(--muted)]">⏳ Loading turns...</div>
      ) : (
        <div className="space-y-3">
          {displayedTurns.map((turn) => {
            const isChallTurn = turn.playerId === info.challengerId
            return (
              <TurnCard
                key={turn.turnNumber}
                turn={turn}
                isLeft={isChallTurn}
                agentAddress={isChallTurn ? info.challengerOwner : info.acceptorOwner}
                isWinner={winnerId === turn.playerId && showSettlement}
              />
            )
          })}
          {/* Thinking skeleton — shared for live + replay */}
          {showSkeleton && (
            <div className={`flex ${nextTurnIsChallenger ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[80%] w-full">
                <ThinkingSkeleton
                  label={`${agentLabel(nextTurnAddr, nextTurnId)} is thinking...`}
                />
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
