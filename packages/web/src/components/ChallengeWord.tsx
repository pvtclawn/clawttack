import { useState, useEffect } from 'react'
import { generateChallengeWord, getTurnTimeout, messageContainsWord } from '../lib/challenge-word'

interface ChallengeWordConfig {
  commitA: `0x${string}`
  commitB: `0x${string}`
}

interface Turn {
  agentAddress: string
  message: string
  turnNumber: number
  timestamp: number
  signature: string
  role: string
}

interface ChallengeWordTurnBadgeProps {
  turn: Turn
  config: ChallengeWordConfig
}

/** Badge showing the challenge word and whether the agent included it */
export function ChallengeWordTurnBadge({ turn, config }: ChallengeWordTurnBadgeProps) {
  const word = generateChallengeWord(turn.turnNumber, config.commitA, config.commitB)
  const included = messageContainsWord(turn.message, word)
  const timeout = getTurnTimeout(turn.turnNumber)

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-bold ${
          included
            ? 'bg-green-900/40 text-green-400 border border-green-800/50'
            : 'bg-red-900/40 text-red-400 border border-red-800/50'
        }`}
      >
        {included ? '✓' : '✗'} {word}
      </span>
      <span className="text-[var(--muted)] flex items-center gap-1">
        <span>⏱️</span>
        <span>{timeout}s</span>
      </span>
    </div>
  )
}

interface ChallengeWordHeaderProps {
  config: ChallengeWordConfig
  totalTurns: number
  turns: Turn[]
}

/** Header section showing challenge word battle info */
export function ChallengeWordHeader({ config, totalTurns, turns }: ChallengeWordHeaderProps) {
  return (
    <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">⏱️</span>
        <div>
          <div className="font-semibold text-sm">Challenge Word Battle</div>
          <div className="text-xs text-[var(--muted)]">
            Each turn has a mandatory word + halving timer (60s → 30s → 15s → ...)
          </div>
        </div>
      </div>

      {/* Word timeline */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totalTurns }, (_, i) => {
          const turnNum = i + 1
          const word = generateChallengeWord(turnNum, config.commitA, config.commitB)
          const timeout = getTurnTimeout(turnNum)
          const turn = turns.find((t) => t.turnNumber === turnNum)
          const included = turn ? messageContainsWord(turn.message, word) : undefined

          return (
            <div
              key={turnNum}
              className={`rounded-lg px-2 py-1 text-center border ${
                included === undefined
                  ? 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
                  : included
                    ? 'bg-green-950/30 border-green-900/40 text-green-400'
                    : 'bg-red-950/30 border-red-900/40 text-red-400'
              }`}
              title={`Turn ${turnNum}: "${word}" (${timeout}s)`}
            >
              <div className="text-[10px] text-[var(--muted)]">T{turnNum}</div>
              <div className="text-xs font-mono font-bold">{word}</div>
              <div className="text-[10px]">{timeout}s</div>
            </div>
          )
        })}
      </div>

      {/* Commits */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[var(--muted)]">
        <div>
          <span className="text-red-400">A:</span> {config.commitA.slice(0, 14)}…
        </div>
        <div>
          <span className="text-blue-400">B:</span> {config.commitB.slice(0, 14)}…
        </div>
      </div>
    </div>
  )
}

interface TimerCountdownProps {
  turnNumber: number
  isActive: boolean
}

/** Animated countdown timer for the current turn during replay */
export function TimerCountdown({ turnNumber, isActive }: TimerCountdownProps) {
  const totalSeconds = getTurnTimeout(turnNumber)
  const [remaining, setRemaining] = useState(totalSeconds)

  useEffect(() => {
    setRemaining(totalSeconds)
  }, [totalSeconds, turnNumber])

  useEffect(() => {
    if (!isActive || remaining <= 0) return
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isActive, remaining])

  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0
  const urgency =
    pct > 50 ? 'text-green-400' : pct > 25 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-20 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono font-bold ${urgency}`}>{remaining}s</span>
    </div>
  )
}
