import { createFileRoute, Link } from '@tanstack/react-router'
import { useBattleList, useArenaStats, type V3BattleInfo } from '../hooks/useChain'
import { formatEther } from 'viem'

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

const RESULT_NAMES = ['Max Turns', 'Timeout', 'Compromise', 'Cancelled'] as const
const RESULT_ICONS = ['⏱️', '⏰', '🏴', '❌'] as const

function shortAddr(addr: string) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function BattlesPage() {
  const { data: stats, isLoading: loadingStats } = useArenaStats()
  const { data: battles, isLoading: loadingBattles } = useBattleList(true)

  const isLoading = loadingStats || loadingBattles

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">⚔️ Battles</h1>
        <span className="text-sm text-[var(--muted)]">
          {isLoading ? 'Loading...' : (
            <>
              {stats?.battlesCount?.toString() ?? '0'} battle(s) · {stats?.agentsCount?.toString() ?? '0'} agents
            </>
          )}
        </span>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Reading from Base Sepolia...
        </div>
      )}

      <div className="space-y-3">
        {(battles ?? []).map((b: V3BattleInfo) => (
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
                    Turn {b.currentTurn}/{b.maxTurns}
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

      {!isLoading && (battles ?? []).length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          No battles found yet. The arena awaits its first fighters.
        </div>
      )}
    </div>
  )
}
