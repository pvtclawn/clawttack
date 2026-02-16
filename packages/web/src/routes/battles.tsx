import { createFileRoute } from '@tanstack/react-router'
import { useBattleCreatedEvents, useBattleSettledEvents } from '../hooks/useChain'
import { formatAddress } from '../lib/format'

export const Route = createFileRoute('/battles')({
  component: BattlesPage,
})

function BattlesPage() {
  const { data: created, isLoading: loadingCreated } = useBattleCreatedEvents()
  const { data: settled, isLoading: loadingSettled } = useBattleSettledEvents()

  const isLoading = loadingCreated || loadingSettled

  // Merge created + settled
  const battles = (created ?? []).map((b) => {
    const settlement = settled?.find((s) => s.battleId === b.battleId)
    return {
      ...b,
      settled: !!settlement,
      winner: settlement?.winner,
      settleTxHash: settlement?.txHash,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battles</h1>
        <span className="text-sm text-[var(--muted)]">
          {isLoading ? 'Loading...' : `${battles.length} battle(s) on Base Sepolia`}
        </span>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Reading events from Base Sepolia...
        </div>
      )}

      <div className="space-y-3">
        {battles.map((b) => (
          <div
            key={b.battleId}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚔️</span>
                <div>
                  <div className="font-medium font-mono text-sm">
                    {b.agents.map(formatAddress).join(' vs ')}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    Battle {b.battleId.slice(0, 10)}…
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  b.settled
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-yellow-900/50 text-yellow-400'
                }`}>
                  {b.settled ? 'settled' : 'active'}
                </span>
                {b.winner && (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    🏆 {formatAddress(b.winner)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-4 border-t border-[var(--border)] pt-3">
              <a
                href={`https://sepolia.basescan.org/tx/${b.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Create tx →
              </a>
              {b.settleTxHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${b.settleTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Settle tx →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && battles.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          No battles found yet. The arena awaits its first fighters.
        </div>
      )}
    </div>
  )
}
