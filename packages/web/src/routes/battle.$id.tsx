import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { agentName, scenarioName } from '../lib/format'
import { SignatureVerifier } from '../components/SignatureVerifier'
import { ChallengeWordTurnBadge, ChallengeWordHeader, TimerCountdown } from '../components/ChallengeWord'
import { useBattleSettledEvents } from '../hooks/useChain'
import { BATTLE_CID_MAP, IPFS_GATEWAY } from '../config/ipfs'

// Map scenarioId strings to known scenario addresses
const SCENARIO_ADDRS: Record<string, string> = {
  'injection-ctf': '0x3D160303816ed14F05EA8784Ef9e021a02B747C4',
  'prisoners-dilemma': '0xa5313FB027eBD60dE2856bA134A689bbd30a6CC9',
  'spy-vs-spy': '0x87cb33ed6eF0D18C3eBB1fB5e8250fA49487D9C6',
  'challenge-word-battle': '0xa2dF845c10cBE9DA434991a91A3f0c3DBC39AAEd',
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

interface AgentAnalysis {
  address: string
  role: string
  stats: {
    avgMessageLength: number
    totalWords: number
    questionCount: number
    exclamationCount: number
    longestMessage: number
    shortestMessage: number
  }
  tactics: string[]
}

interface BattleAnalysis {
  totalTurns: number
  agents: AgentAnalysis[]
  highlights: string[]
  tensionCurve: number[]
}

interface BattleLog {
  battleId: string
  scenarioId: string
  agents: Array<{ address: string; name: string }>
  turns: Turn[]
  outcome: { winnerAddress: string | null; reason: string } | null
  commitment: string
  merkleRoot?: string
  _analysis?: BattleAnalysis
  challengeWord?: {
    commitA: `0x${string}`
    commitB: `0x${string}`
  }
}

function useBattleLog(battleIdHash: string) {
  return useQuery({
    queryKey: ['battleLog', battleIdHash],
    queryFn: async (): Promise<BattleLog | null> => {
      // Try IPFS first (content-addressed, verifiable)
      const cid = BATTLE_CID_MAP[battleIdHash]
      if (cid) {
        try {
          const res = await fetch(`${IPFS_GATEWAY}/${cid}`)
          if (res.ok) return await res.json()
        } catch {
          // IPFS gateway failed, fall through to local
        }
      }

      // Fallback: static JSON (legacy, will be removed)
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
  const { data: settlements } = useBattleSettledEvents()
  const [visibleTurns, setVisibleTurns] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)

  // On-chain settlement overrides relay outcome
  const onChainSettlement = settlements?.find((s) => s.battleId === id)
  const resolvedOutcome = (() => {
    if (onChainSettlement) {
      const isZeroAddr = onChainSettlement.winner === '0x0000000000000000000000000000000000000000'
      return {
        winnerAddress: isZeroAddr ? null : onChainSettlement.winner,
        reason: isZeroAddr ? 'Draw (on-chain)' : 'Settled on-chain',
        settled: true,
        settleTxHash: onChainSettlement.txHash,
      }
    }
    if (log?.outcome) {
      return { ...log.outcome, settled: false, settleTxHash: null }
    }
    return null
  })()

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
            {BATTLE_CID_MAP[id] && (
              <a
                href={`${IPFS_GATEWAY}/${BATTLE_CID_MAP[id]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                📌 IPFS ↗
              </a>
            )}
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
      {resolvedOutcome && (
        <div className={`rounded-xl border p-4 ${resolvedOutcome.settled ? 'border-green-900/50 bg-green-950/20' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <div>
              <div className="font-medium">
                {resolvedOutcome.winnerAddress
                  ? `Winner: ${agentName(resolvedOutcome.winnerAddress)}`
                  : 'Draw'}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {resolvedOutcome.reason}
                {resolvedOutcome.settled && resolvedOutcome.settleTxHash && (
                  <>
                    {' · '}
                    <a
                      href={`https://sepolia.basescan.org/tx/${resolvedOutcome.settleTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      View tx ↗
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Challenge Word Battle header */}
      {log.challengeWord && (
        <ChallengeWordHeader
          config={log.challengeWord}
          totalTurns={log.turns.length}
          turns={log.turns}
        />
      )}

      {/* Turn-by-turn transcript */}
      <div className="space-y-3">
        {displayedTurns.map((turn, idx) => {
          const isLeft = turn.role === 'attacker' || (turn.role === 'spy' && idx % 2 === 0)
          const roleEmoji = turn.role === 'attacker' ? '🗡️' : turn.role === 'defender' ? '🛡️' : '🕵️'
          const roleColor = isLeft ? 'text-red-400' : 'text-blue-400'
          const bgClass = isLeft
            ? 'bg-red-950/30 border border-red-900/30'
            : 'bg-blue-950/30 border border-blue-900/30'
          return (
            <div
              key={turn.turnNumber}
              className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[80%] rounded-xl p-4 ${bgClass}`}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span>{roleEmoji}</span>
                  <span className={roleColor}>
                    {agentName(turn.agentAddress)}
                  </span>
                  <span className="text-[var(--muted)]">Turn {turn.turnNumber}</span>
                </div>
                <div className="text-sm leading-relaxed">{turn.message}</div>
                {log.challengeWord && (
                  <ChallengeWordTurnBadge turn={turn} config={log.challengeWord} />
                )}
                <div className="mt-2 text-[10px] text-[var(--muted)] font-mono truncate">
                  sig: {turn.signature.slice(0, 20)}…
                </div>
              </div>
            </div>
          )
        })}
        {isReplaying && visibleTurns < log.turns.length && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <span className="animate-pulse">●</span> Next turn...
              {log.challengeWord && (
                <TimerCountdown
                  turnNumber={visibleTurns + 1}
                  isActive={isReplaying}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Signature Verification */}
      {log.turns.length > 0 && <SignatureVerifier turns={log.turns} battleId={log.battleId} />}

      {/* Battle Analysis */}
      {log._analysis && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            📊 Battle Analysis
          </h3>

          {/* Agent Strategy Cards */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {log._analysis.agents.map((agent) => {
              const name = log.agents.find(a => a.address === agent.address)?.name ?? agent.address.slice(0, 10)
              const isLeft = agent.role === 'attacker' || agent.role === 'spy'
              return (
                <div
                  key={agent.address}
                  className={`rounded-lg p-4 space-y-2 ${
                    isLeft
                      ? 'bg-red-950/20 border border-red-900/20'
                      : 'bg-blue-950/20 border border-blue-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-[var(--muted)]">{agent.role}</span>
                  </div>
                  {/* Tactics */}
                  <div className="flex flex-wrap gap-1">
                    {agent.tactics.map((t) => (
                      <span
                        key={t}
                        className="inline-block rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--accent)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-bold text-[var(--accent)]">{agent.stats.totalWords}</div>
                      <div className="text-[10px] text-[var(--muted)]">Words</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--accent)]">{agent.stats.avgMessageLength}</div>
                      <div className="text-[10px] text-[var(--muted)]">Avg/Turn</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--accent)]">{agent.stats.questionCount}</div>
                      <div className="text-[10px] text-[var(--muted)]">Questions</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Highlights */}
          {log._analysis.highlights.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--muted)]">Highlights</div>
              {log._analysis.highlights.map((h, i) => (
                <div key={i} className="text-xs text-[var(--muted)] flex items-center gap-2">
                  <span>💡</span> {h}
                </div>
              ))}
            </div>
          )}

          {/* Tension Curve (simple ASCII bar chart) */}
          {log._analysis.tensionCurve.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--muted)]">Tension</div>
              <div className="flex items-end gap-px h-8">
                {log._analysis.tensionCurve.map((t, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-[var(--accent)] opacity-70"
                    style={{ height: `${Math.max(4, t * 100)}%` }}
                    title={`Turn ${i + 1}: ${Math.round(t * 100)}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--muted)]">
                <span>Turn 1</span>
                <span>Turn {log._analysis.tensionCurve.length}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
