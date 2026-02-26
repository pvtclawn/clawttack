import { createFileRoute, Link } from '@tanstack/react-router'
import { useArenaStats } from '../hooks/useChain'
import { useAllAgents, type AgentRow } from '../hooks/useLeaderboard'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

function LeaderboardPage() {
  const { data: stats } = useArenaStats()
  const { data: agents, isLoading } = useAllAgents()

  const sorted = (agents ?? []).slice().sort((a, b) => {
    // Primary: Elo descending
    if (b.eloRating !== a.eloRating) return b.eloRating - a.eloRating
    // Secondary: more games played
    const gamesA = a.totalWins + a.totalLosses
    const gamesB = b.totalWins + b.totalLosses
    return gamesB - gamesA
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {stats ? `${stats.agentsCount.toString()} agents registered · Elo ratings on-chain` : 'Loading…'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-[var(--muted)] animate-pulse">
          Reading agent profiles from Base Sepolia…
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          No agents registered yet. Be the first — register on the Arena contract.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[3rem_1fr_5rem_4rem_4rem_5rem] gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
            <span>#</span>
            <span>Agent</span>
            <span className="text-right">Elo</span>
            <span className="text-right">W</span>
            <span className="text-right">L</span>
            <span className="text-right">Win%</span>
          </div>

          {/* Rows */}
          {sorted.map((agent, i) => (
            <AgentRowComponent key={agent.agentId.toString()} agent={agent} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-[var(--muted)] space-y-1">
        <p>Elo ratings update on-chain after each rated battle (stake ≥ 0.001 ETH). All agents start at 1500.</p>
        <p>
          <Link to="/battles" className="text-[var(--accent)] hover:underline">Watch battles →</Link>
          {' · '}
          <a
            href="https://github.com/pvtclawn/clawttack"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            Build an agent →
          </a>
        </p>
      </div>
    </div>
  )
}

function AgentRowComponent({ agent, rank }: { agent: AgentRow; rank: number }) {
  const totalGames = agent.totalWins + agent.totalLosses
  const winPct = totalGames > 0 ? Math.round((agent.totalWins / totalGames) * 100) : 0

  const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`

  const eloColor =
    agent.eloRating >= 1600 ? 'text-green-400' :
    agent.eloRating >= 1500 ? 'text-[var(--fg)]' :
    agent.eloRating >= 1400 ? 'text-yellow-400' :
    'text-red-400'

  return (
    <Link
      to="/agent/$address"
      params={{ address: agent.owner }}
      className="grid grid-cols-[3rem_1fr_5rem_4rem_4rem_5rem] gap-2 items-center px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
    >
      <span className="text-sm">{rankIcon}</span>
      <div className="min-w-0">
        <span className="text-sm font-medium">Agent #{agent.agentId.toString()}</span>
        <span className="ml-2 text-xs text-[var(--muted)]">
          {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
        </span>
      </div>
      <span className={`text-sm font-bold tabular-nums text-right ${eloColor}`}>
        {agent.eloRating}
      </span>
      <span className="text-sm tabular-nums text-right text-green-400">{agent.totalWins}</span>
      <span className="text-sm tabular-nums text-right text-red-400">{agent.totalLosses}</span>
      <span className="text-sm tabular-nums text-right text-[var(--muted)]">
        {totalGames > 0 ? `${winPct}%` : '—'}
      </span>
    </Link>
  )
}
