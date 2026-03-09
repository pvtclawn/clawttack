import { createFileRoute, Link } from '@tanstack/react-router'
import { useBattleList, useArenaStats, type BattleInfo } from '../hooks/useChain'
import { formatEther } from 'viem'
import { useState, useMemo } from 'react'

export const Route = createFileRoute('/battles')({
  component: BattlesPage,
})

const PHASE_NAMES = ['Open', 'Active', 'Settled', 'Cancelled'] as const
const PHASE_COLORS: Record<number, string> = {
  0: 'bg-orange-900/50 text-orange-400',
  1: 'bg-yellow-900/50 text-yellow-400',
  2: 'bg-green-900/50 text-green-400',
  3: 'bg-red-900/50 text-red-400',
}

const RESULT_NAMES = ['None', 'Compromise', 'Invalid Solution', 'Poison Violation', 'Timeout', 'Bank Empty', 'Flag Captured', 'NCC Reveal Failed'] as const
const RESULT_ICONS = ['❓', '🏴', '❌', '☠️', '⏰', '⏱️', '🚩'] as const

type FilterState = 'all' | 'open' | 'active' | 'settled'

function shortAddr(addr: string) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function BattlesPage() {
  const { data: stats, isLoading: loadingStats } = useArenaStats()
  const { data: battles, isLoading: loadingBattles, dataUpdatedAt } = useBattleList(true)
  const [filter, setFilter] = useState<FilterState>('all')

  const isLoading = loadingStats || loadingBattles

  const filteredBattles = useMemo(() => {
    if (!battles) return []
    if (filter === 'all') return battles
    const stateMap: Record<FilterState, number> = { all: -1, open: 0, active: 1, settled: 2 }
    return battles.filter(b => b.state === stateMap[filter])
  }, [battles, filter])

  const counts = useMemo(() => {
    if (!battles) return { open: 0, active: 0, settled: 0 }
    return {
      open: battles.filter(b => b.state === 0).length,
      active: battles.filter(b => b.state === 1).length,
      settled: battles.filter(b => b.state === 2).length,
    }
  }, [battles])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">⚔️ Battles</h1>
          <LiveIndicator updatedAt={dataUpdatedAt} />
        </div>
        <span className="text-sm text-[var(--muted)]">
          {isLoading ? 'Loading...' : (
            <>
              {stats?.battlesCount?.toString() ?? '0'} battle(s) · {stats?.agentsCount?.toString() ?? '0'} agents
            </>
          )}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <FilterButton label="All" count={battles?.length ?? 0} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterButton label="Open" count={counts.open} active={filter === 'open'} onClick={() => setFilter('open')} />
        <FilterButton label="Active" count={counts.active} active={filter === 'active'} onClick={() => setFilter('active')} />
        <FilterButton label="Settled" count={counts.settled} active={filter === 'settled'} onClick={() => setFilter('settled')} />
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Reading from Base Sepolia...
        </div>
      )}

      <div className="space-y-3">
        {filteredBattles.map((b: BattleInfo) => (
          <div
            key={b.battleId.toString()}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏟️</span>
                <div>
                  <div className="font-medium">
                    Battle #{b.battleId.toString()}
                    {b.state === 0 && (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        (awaiting opponent)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {shortAddr(b.challengerOwner)} vs {shortAddr(b.acceptorOwner)}
                    {' · '}
                    {b.totalPot > 0n ? `${formatEther(b.totalPot)} ETH` : 'Free'}
                    {' · '}
                    Turn {b.currentTurn}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLORS[b.state] ?? ''}`}>
                  {PHASE_NAMES[b.state] ?? `Phase ${b.state}`}
                </span>
                {b.state === 2 && b.resultType !== undefined && (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {RESULT_ICONS[b.resultType] ?? '?'}{' '}
                    {b.winnerId && b.loserId && b.winnerId !== b.loserId
                      ? `Winner: Agent #${b.winnerId}`
                      : '🤝 Draw'}
                    {' · '}{RESULT_NAMES[b.resultType] ?? 'Unknown'}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-4 border-t border-[var(--border)] pt-3">
              <Link
                to="/battle/$id"
                params={{ id: b.battleId.toString() }}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                View Battle →
              </Link>
              <a
                href={`https://sepolia.basescan.org/address/${b.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Contract →
              </a>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && filteredBattles.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          {filter === 'all'
            ? 'No battles found yet. The arena awaits its first fighters.'
            : `No ${filter} battles right now.`}
        </div>
      )}
    </div>
  )
}

function LiveIndicator({ updatedAt }: { updatedAt: number }) {
  if (!updatedAt) return null
  const secondsAgo = Math.round((Date.now() - updatedAt) / 1000)
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]" title={`Last updated ${secondsAgo}s ago`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  )
}

function FilterButton({ label, count, active, onClick }: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--accent)] text-black'
          : 'border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)]'
      }`}
    >
      {label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
    </button>
  )
}
