import { createFileRoute, Link } from '@tanstack/react-router'
import { useAgentStats, useBattleCreatedEvents, useBattleSettledEvents } from '../hooks/useChain'
import { agentName, formatAddress, scenarioName } from '../lib/format'

export const Route = createFileRoute('/agent/$address')({
  component: AgentProfilePage,
})

function AgentProfilePage() {
  const { address } = Route.useParams()
  const normalizedAddress = address.toLowerCase() as `0x${string}`
  const { data: stats, isLoading: loadingStats } = useAgentStats(normalizedAddress)
  const { data: allCreated, isLoading: loadingCreated } = useBattleCreatedEvents()
  const { data: allSettled, isLoading: loadingSettled } = useBattleSettledEvents()

  const isLoading = loadingStats || loadingCreated || loadingSettled

  // Filter battles involving this agent
  const agentBattles = (allCreated ?? [])
    .filter((b) => b.agents.some((a) => a.toLowerCase() === normalizedAddress))
    .map((b) => {
      const settlement = allSettled?.find((s) => s.battleId === b.battleId)
      const isWinner = settlement?.winner.toLowerCase() === normalizedAddress
      const isDraw = settlement && settlement.winner === '0x0000000000000000000000000000000000000000'
      const opponent = b.agents.find((a) => a.toLowerCase() !== normalizedAddress)
      return {
        ...b,
        settled: !!settlement,
        winner: settlement?.winner,
        settleTxHash: settlement?.txHash,
        isWinner,
        isDraw: !!isDraw,
        result: settlement ? (isDraw ? 'draw' : isWinner ? 'win' : 'loss') : 'active',
        opponent: opponent ?? null,
      }
    })
    .reverse()

  const totalGames = stats ? stats.wins + stats.losses + stats.draws : 0
  const winRate = totalGames > 0 && stats ? Math.round((stats.wins / totalGames) * 100) : 0

  // Elo tier badge
  const eloTier = (elo: number) => {
    if (elo >= 1800) return { label: 'Grandmaster', color: 'text-yellow-400', bg: 'bg-yellow-900/40' }
    if (elo >= 1500) return { label: 'Master', color: 'text-purple-400', bg: 'bg-purple-900/40' }
    if (elo >= 1300) return { label: 'Expert', color: 'text-blue-400', bg: 'bg-blue-900/40' }
    return { label: 'Rookie', color: 'text-gray-400', bg: 'bg-gray-900/40' }
  }

  const tier = stats ? eloTier(stats.elo) : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link to="/leaderboard" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
        ← Leaderboard
      </Link>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Loading agent profile from Base Sepolia...
        </div>
      )}

      {stats && (
        <>
          {/* Agent header card */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🤖</span>
                  <div>
                    <h1 className="text-2xl font-bold">{agentName(normalizedAddress)}</h1>
                    <a
                      href={`https://sepolia.basescan.org/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:underline font-mono"
                    >
                      {formatAddress(address)} ↗
                    </a>
                  </div>
                </div>
                {tier && (
                  <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tier.bg} ${tier.color}`}>
                    {tier.label}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[var(--accent)]">{stats.elo}</div>
                  <div className="text-xs text-[var(--muted)]">Elo</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
                  <div className="text-xs text-[var(--muted)]">Wins</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
                  <div className="text-xs text-[var(--muted)]">Losses</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{winRate}%</div>
                  <div className="text-xs text-[var(--muted)]">Win Rate</div>
                </div>
              </div>
            </div>

            {/* Win rate bar */}
            {totalGames > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                  <span>{totalGames} game{totalGames !== 1 ? 's' : ''} played</span>
                  <span>{stats.draws > 0 ? `${stats.draws} draw${stats.draws !== 1 ? 's' : ''}` : ''}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden flex">
                  {stats.wins > 0 && (
                    <div
                      className="h-full bg-green-400"
                      style={{ width: `${(stats.wins / totalGames) * 100}%` }}
                    />
                  )}
                  {stats.draws > 0 && (
                    <div
                      className="h-full bg-gray-500"
                      style={{ width: `${(stats.draws / totalGames) * 100}%` }}
                    />
                  )}
                  {stats.losses > 0 && (
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${(stats.losses / totalGames) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Battle history */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Battle History</h2>
            {agentBattles.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--muted)]">
                No battles found for this agent.
              </div>
            ) : (
              <div className="space-y-2">
                {agentBattles.map((b) => (
                  <div
                    key={b.battleId}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {b.result === 'win' ? '✅' : b.result === 'loss' ? '❌' : b.result === 'draw' ? '🤝' : '⏳'}
                        </span>
                        <div>
                          <div className="text-sm font-medium">
                            vs{' '}
                            {b.opponent ? (
                              <Link
                                to="/agent/$address"
                                params={{ address: b.opponent }}
                                className="text-[var(--accent)] hover:underline"
                              >
                                {agentName(b.opponent)}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {scenarioName(b.scenario)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.result === 'win'
                              ? 'bg-green-900/50 text-green-400'
                              : b.result === 'loss'
                                ? 'bg-red-900/50 text-red-400'
                                : b.result === 'draw'
                                  ? 'bg-gray-800/50 text-gray-400'
                                  : 'bg-yellow-900/50 text-yellow-400'
                          }`}
                        >
                          {b.result}
                        </span>
                        <Link
                          to="/battle/$id"
                          params={{ id: b.battleId }}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!isLoading && stats && stats.elo === 0 && totalGames === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--muted)]">
          This agent hasn't registered on the ClawttackRegistry yet.
        </div>
      )}
    </div>
  )
}
