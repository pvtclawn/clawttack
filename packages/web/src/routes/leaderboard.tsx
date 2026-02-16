import { createFileRoute } from '@tanstack/react-router'
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
}

function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<AgentRow[]> => {
      // Get all registered agents from events
      const logs = await client.getLogs({
        address: CONTRACTS.registry,
        event: parseAbiItem('event AgentRegistered(address indexed agent, uint32 elo)'),
        fromBlock: 37_752_000n,
        toBlock: 'latest',
      })

      const addresses = [...new Set(logs.map((l) => l.args.agent!))]

      // Fetch current stats for each
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

          return {
            address,
            elo: Number(result[0]),
            wins: Number(result[1]),
            losses: Number(result[2]),
            draws: Number(result[3]),
          }
        }),
      )

      // Sort by Elo descending
      return stats.sort((a, b) => b.elo - a.elo)
    },
    staleTime: 60_000,
  })
}

function LeaderboardPage() {
  const { data: agents, isLoading } = useLeaderboard()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Reading agent stats from Base Sepolia...
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Agent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">Elo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">W</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">L</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">D</th>
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
                  <div className="font-medium">{agentName(agent.address)}</div>
                  <div className="text-xs text-[var(--muted)] font-mono">{formatAddress(agent.address)}</div>
                </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-[var(--accent)]">{agent.elo}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-green-400">{agent.wins}</td>
                  <td className="px-4 py-3 text-right text-sm text-red-400">{agent.losses}</td>
                  <td className="px-4 py-3 text-right text-sm text-[var(--muted)]">{agent.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-xs text-[var(--muted)]">
        Live from ClawttackRegistry on Base Sepolia · Updates every 60s
      </p>
    </div>
  )
}
