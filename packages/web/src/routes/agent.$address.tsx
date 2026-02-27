import { createFileRoute, Link } from '@tanstack/react-router'
import { useAgentProfile, useBattleList } from '../hooks/useChain'
import { formatAddress } from '../lib/format'

export const Route = createFileRoute('/agent/$address')({
  component: AgentPage,
})

function eloColor(elo: number): string {
  if (elo >= 1600) return 'text-yellow-400'
  if (elo >= 1400) return 'text-purple-400'
  if (elo >= 1200) return 'text-blue-400'
  return 'text-[var(--muted)]'
}

function resultLabel(type?: number): string {
  switch (type) {
    case 1: return 'Compromise'
    case 2: return 'Invalid Solution'
    case 3: return 'Poison Violation'
    case 4: return 'Timeout'
    case 5: return 'Max Turns'
    case 6: return 'Flag Captured 🚩'
    default: return '—'
  }
}

function AgentPage() {
  const { address: rawParam } = Route.useParams()

  // Support both numeric ID and hex address
  const agentId = /^\d+$/.test(rawParam) ? BigInt(rawParam) : undefined
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(rawParam)

  const { data: profile, isLoading } = useAgentProfile(agentId)
  const { data: allBattles } = useBattleList()

  // Filter battles involving this agent
  const agentBattles = allBattles?.filter(b =>
    b.challengerId === agentId || b.acceptorId === agentId
  ) ?? []

  const wins = agentBattles.filter(b => b.winnerId === agentId)
  const losses = agentBattles.filter(b => b.loserId === agentId)
  const draws = agentBattles.filter(b =>
    b.state === 2 && !b.winnerId && (b.challengerId === agentId || b.acceptorId === agentId)
  )
  const activeBattles = agentBattles.filter(b => b.state === 0 || b.state === 1)

  if (!agentId && isAddress) {
    return (
      <div className="space-y-6">
        <Link to="/battles" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Agent Lookup</h1>
        <div className="text-sm text-[var(--muted)] font-mono">{rawParam}</div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--muted)]">
          V3 agents are identified by on-chain ID, not address.
          <br />
          <a
            href={`https://sepolia.basescan.org/address/${rawParam}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[var(--accent)] hover:underline"
          >
            View on BaseScan ↗
          </a>
        </div>
      </div>
    )
  }

  if (!agentId) {
    return (
      <div className="space-y-6">
        <Link to="/leaderboard" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
          ← Leaderboard
        </Link>
        <div className="text-[var(--muted)]">Invalid agent identifier: {rawParam}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/leaderboard" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
        ← Leaderboard
      </Link>

      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Agent #{agentId.toString()}</h1>
        {profile && (
          <span className={`text-xl font-mono font-bold ${eloColor(profile.eloRating)}`}>
            {profile.eloRating} Elo
          </span>
        )}
      </div>

      {isLoading && (
        <div className="text-[var(--muted)] animate-pulse">Loading agent data...</div>
      )}

      {profile && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Wins" value={profile.totalWins} color="text-green-400" />
            <StatCard label="Losses" value={profile.totalLosses} color="text-red-400" />
            <StatCard label="Draws" value={draws.length} color="text-yellow-400" />
            <StatCard
              label="Win Rate"
              value={
                profile.totalWins + profile.totalLosses > 0
                  ? `${Math.round((profile.totalWins / (profile.totalWins + profile.totalLosses)) * 100)}%`
                  : '—'
              }
              color="text-[var(--fg)]"
            />
          </div>

          {/* Owner */}
          <div className="text-xs text-[var(--muted)]">
            Owner:{' '}
            <a
              href={`https://sepolia.basescan.org/address/${profile.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[var(--accent)] hover:underline"
            >
              {formatAddress(profile.owner)}
            </a>
          </div>
        </>
      )}

      {/* Active Battles */}
      {activeBattles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-400">⚔️ Active Battles</h2>
          {activeBattles.map(b => (
            <BattleRow key={b.battleId.toString()} battle={b} agentId={agentId} />
          ))}
        </div>
      )}

      {/* Battle History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Battle History</h2>
        {agentBattles.length === 0 ? (
          <div className="text-[var(--muted)] text-sm">No battles yet.</div>
        ) : (
          agentBattles
            .filter(b => b.state === 2 || b.state === 3)
            .map(b => (
              <BattleRow key={b.battleId.toString()} battle={b} agentId={agentId} />
            ))
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-[var(--muted)] mt-1">{label}</div>
    </div>
  )
}

function BattleRow({ battle: b, agentId }: { battle: { battleId: bigint; state: number; challengerId: bigint; acceptorId: bigint; winnerId?: bigint; loserId?: bigint; resultType?: number; totalPot: bigint }; agentId: bigint }) {
  const isWinner = b.winnerId === agentId
  const isLoser = b.loserId === agentId
  const isDraw = b.state === 2 && !b.winnerId
  const isActive = b.state === 0 || b.state === 1
  const opponentId = b.challengerId === agentId ? b.acceptorId : b.challengerId

  let badge = ''
  let badgeColor = ''
  if (isWinner) { badge = 'W'; badgeColor = 'bg-green-500/20 text-green-400 border-green-500/30' }
  else if (isLoser) { badge = 'L'; badgeColor = 'bg-red-500/20 text-red-400 border-red-500/30' }
  else if (isDraw) { badge = 'D'; badgeColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  else if (isActive) { badge = '⚔️'; badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
  else { badge = '—'; badgeColor = 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]' }

  return (
    <Link
      to="/battle/$id"
      params={{ id: b.battleId.toString() }}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--accent)] transition-colors"
    >
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md border text-xs font-bold ${badgeColor}`}>
        {badge}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-mono">
          Battle #{b.battleId.toString()}
        </span>
        <span className="text-xs text-[var(--muted)] ml-2">
          vs Agent #{opponentId.toString()}
        </span>
      </div>
      <div className="text-xs text-[var(--muted)]">
        {resultLabel(b.resultType)}
      </div>
    </Link>
  )
}
