import { createFileRoute, Link } from '@tanstack/react-router'
import {
  useBattleCreatedEvents,
  useBattleSettledEvents,
  useArenaChallenges,
  useArenaAccepts,
  useArenaSettlements,
} from '../hooks/useChain'
import { agentName, scenarioName, scenarioEmoji, formatAddress } from '../lib/format'

export const Route = createFileRoute('/battles')({
  component: BattlesPage,
})

type BattleSource = 'registry' | 'arena'

interface UnifiedBattle {
  source: BattleSource
  battleId: `0x${string}`
  agents: readonly `0x${string}`[]
  stake: bigint
  settled: boolean
  winner?: `0x${string}`
  reason?: string
  blockNumber: bigint
  createTxHash: `0x${string}`
  settleTxHash?: `0x${string}`
  // Registry-specific
  scenario?: `0x${string}`
  // Arena-specific
  phase?: string
}

function BattlesPage() {
  // Registry events
  const { data: created, isLoading: loadingCreated } = useBattleCreatedEvents()
  const { data: settled, isLoading: loadingSettled } = useBattleSettledEvents()

  // Arena events
  const { data: arenaChallenges, isLoading: loadingChallenges } = useArenaChallenges()
  const { data: arenaAccepts, isLoading: loadingAccepts } = useArenaAccepts()
  const { data: arenaSettlements, isLoading: loadingArenaSettled } = useArenaSettlements()

  const isLoading = loadingCreated || loadingSettled || loadingChallenges || loadingAccepts || loadingArenaSettled

  // Build unified battle list
  const battles: UnifiedBattle[] = []

  // Registry battles
  for (const b of created ?? []) {
    const settlement = settled?.find((s) => s.battleId === b.battleId)
    battles.push({
      source: 'registry',
      battleId: b.battleId,
      agents: b.agents,
      stake: b.entryFee,
      settled: !!settlement,
      winner: settlement?.winner,
      blockNumber: b.blockNumber,
      createTxHash: b.txHash,
      settleTxHash: settlement?.txHash,
      scenario: b.scenario,
    })
  }

  // Arena battles
  for (const c of arenaChallenges ?? []) {
    const accept = arenaAccepts?.find((a) => a.battleId === c.battleId)
    const settlement = arenaSettlements?.find((s) => s.battleId === c.battleId)
    const agents: `0x${string}`[] = [c.challenger]
    if (accept) agents.push(accept.opponent)

    let phase = 'open'
    if (settlement) phase = 'settled'
    else if (accept) phase = 'active'

    battles.push({
      source: 'arena',
      battleId: c.battleId,
      agents,
      stake: c.stake,
      settled: !!settlement,
      winner: settlement?.winner,
      reason: settlement?.reason,
      blockNumber: c.blockNumber,
      createTxHash: c.txHash,
      settleTxHash: settlement?.txHash,
      phase,
    })
  }

  // Sort newest first by block number
  battles.sort((a, b) => Number(b.blockNumber - a.blockNumber))

  const registryCount = battles.filter((b) => b.source === 'registry').length
  const arenaCount = battles.filter((b) => b.source === 'arena').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battles</h1>
        <span className="text-sm text-[var(--muted)]">
          {isLoading ? 'Loading...' : (
            <>
              {battles.length} battle(s) on Base Sepolia
              {arenaCount > 0 && (
                <span className="ml-2 text-xs">
                  ({registryCount} registry · {arenaCount} arena)
                </span>
              )}
            </>
          )}
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
            key={`${b.source}-${b.battleId}`}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {b.source === 'arena' ? '🏟️' : scenarioEmoji(b.scenario ?? '')}
                </span>
                <div>
                  <div className="font-medium">
                    {b.agents.map(agentName).join(' vs ')}
                    {b.source === 'arena' && b.agents.length === 1 && (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        (awaiting opponent)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {b.source === 'arena' ? 'Arena' : scenarioName(b.scenario ?? '')}
                    {' · '}
                    {b.stake > 0n ? `${Number(b.stake) / 1e18} ETH` : 'Free'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.source === 'arena'
                      ? 'bg-purple-900/50 text-purple-400'
                      : 'bg-[var(--surface)] text-[var(--muted)]'
                  }`}>
                    {b.source}
                  </span>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.settled
                      ? 'bg-green-900/50 text-green-400'
                      : b.phase === 'open'
                        ? 'bg-orange-900/50 text-orange-400'
                        : 'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {b.settled ? 'settled' : (b.phase ?? 'active')}
                  </span>
                </div>
                {b.winner && (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    🏆 {agentName(b.winner)}
                    {b.reason && <span className="ml-1">· {b.reason}</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-4 border-t border-[var(--border)] pt-3">
              {b.source === 'arena' ? (
                <Link
                  to="/arena/$id"
                  params={{ id: b.battleId }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  View Battle →
                </Link>
              ) : (
                <Link
                  to="/battle/$id"
                  params={{ id: b.battleId }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  View Battle →
                </Link>
              )}
              <a
                href={`https://sepolia.basescan.org/tx/${b.createTxHash}`}
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
