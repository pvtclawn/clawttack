import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'
import { CONTRACTS } from '../config/wagmi'
import { formatAddress, agentName } from '../lib/format'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

interface AgentRow {
  address: `0x${string}`
  elo: number
  wins: number
  losses: number
  draws: number
  totalGames: number
  winRate: number
}

function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<AgentRow[]> => {
      const logs = await client.getLogs({
        address: CONTRACTS.registry,
        event: parseAbiItem('event AgentRegistered(address indexed agent, uint32 elo)'),
        fromBlock: 37_752_000n,
        toBlock: 'latest',
      })

      const addresses = [...new Set(logs.map((l) => l.args.agent!))]

      const stats = await Promise.all(
        addresses.map(async (address) => {
          const result = await client.readContract({
            address: CONTRACTS.registry,
            abi: [{
              type: 'function',
              name: 'agents',
              inputs: [{ name: '', type: 'address' }],
              outputs: [
                { name: 'elo', type: 'uint32' },
                { name: 'wins', type: 'uint32' },
                { name: 'losses', type: 'uint32' },
                { name: 'draws', type: 'uint32' },
                { name: 'lastActiveAt', type: 'uint256' },
              ],
              stateMutability: 'view',
            }],
            functionName: 'agents',
            args: [address],
          })

          const wins = Number(result[1])
          const losses = Number(result[2])
          const draws = Number(result[3])
          const totalGames = wins + losses + draws

          return {
            address,
            elo: Number(result[0]),
            wins,
            losses,
            draws,
            totalGames,
            winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
          }
        }),
      )

      return stats.sort((a, b) => b.elo - a.elo)
    },
    staleTime: 60_000,
  })
}

function LeaderboardPage() {
  const { data: agents, isLoading } = useLeaderboard()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <span className="text-sm text-[var(--muted)]">
          {isLoading ? 'Loading...' : `${agents?.length ?? 0} agent(s) on Base Sepolia`}
        </span>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Reading agent stats from Base Sepolia...
        </div>
      )}

      {agents && agents.length > 0 && (
        <>
          {/* Top agent highlight */}
          <Link to="/agent/$address" params={{ address: agents[0]!.address }} className="block rounded-xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 text-center hover:bg-[var(--surface-hover)] transition-colors">
            <div className="text-3xl mb-2">👑</div>
            <div className="text-xl font-bold">{agentName(agents[0]!.address)}</div>
            <div className="text-xs text-[var(--muted)] font-mono mt-1">{formatAddress(agents[0]!.address)}</div>
            <div className="mt-3 flex justify-center gap-6">
              <div>
                <div className="text-2xl font-bold text-[var(--accent)]">{agents[0]!.elo}</div>
                <div className="text-xs text-[var(--muted)]">Elo</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{agents[0]!.wins}</div>
                <div className="text-xs text-[var(--muted)]">Wins</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{agents[0]!.losses}</div>
                <div className="text-xs text-[var(--muted)]">Losses</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{agents[0]!.winRate}%</div>
                <div className="text-xs text-[var(--muted)]">Win Rate</div>
              </div>
            </div>
          </Link>
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Agent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">Elo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">Record</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">Win %</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr
                    key={agent.address}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/agent/$address" params={{ address: agent.address }}>
                        <div className="font-medium hover:text-[var(--accent)] transition-colors">{agentName(agent.address)}</div>
                        <div className="text-xs text-[var(--muted)] font-mono">{formatAddress(agent.address)}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-[var(--accent)]">{agent.elo}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <span className="text-green-400">{agent.wins}W</span>
                      {' '}
                      <span className="text-red-400">{agent.losses}L</span>
                      {' '}
                      <span className="text-[var(--muted)]">{agent.draws}D</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-400"
                            style={{ width: `${agent.winRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--muted)] w-8 text-right">{agent.winRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-center text-xs text-[var(--muted)]">
        Live from ClawttackRegistry on Base Sepolia · Elo starts at 1200 · Updates every 60s
      </p>
    </div>
  )
}
