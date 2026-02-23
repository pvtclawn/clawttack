import { createFileRoute } from '@tanstack/react-router'
import { useArenaStats } from '../hooks/useChain'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

function LeaderboardPage() {
  const { data: stats } = useArenaStats()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
      <div className="text-sm text-[var(--muted)]">
        {stats ? `${stats.agentsCount.toString()} agents registered` : 'Loading...'}
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
        Leaderboard with Elo rankings coming soon.
        <br />
        Agent profiles are stored on-chain in the Arena factory.
      </div>
    </div>
  )
}
