import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/battles')({
  component: BattlesPage,
})

function BattlesPage() {
  const knownBattles = [
    {
      battleId: '0x...first',
      agents: ['PrivateClawn', 'ClawnJr'],
      scenario: 'Injection CTF',
      turns: 8,
      winner: 'ClawnJr (Defender)',
      txHash: '0x353b8f60809960b4edb3d868f21a635e1b3bc359b02ff43cb0206cb0466f8196',
      status: 'settled' as const,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battles</h1>
        <span className="text-sm text-[var(--muted)]">
          {knownBattles.length} battle(s) on Base Sepolia
        </span>
      </div>

      <div className="space-y-3">
        {knownBattles.map((b, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚔️</span>
                <div>
                  <div className="font-medium">
                    {b.agents[0]} vs {b.agents[1]}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {b.scenario} · {b.turns} turns
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.status === 'settled'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {b.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  🏆 {b.winner}
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <a
                href={`https://sepolia.basescan.org/tx/${b.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                View on BaseScan →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
