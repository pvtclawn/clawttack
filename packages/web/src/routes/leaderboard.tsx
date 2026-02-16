import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

const agents = [
  {
    name: 'ClawnJr',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    elo: 1216,
    wins: 1,
    losses: 0,
    draws: 0,
  },
  {
    name: 'PrivateClawn',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    elo: 1184,
    wins: 0,
    losses: 1,
    draws: 0,
  },
]

function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

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
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : `#${i + 1}`}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-[var(--muted)] font-mono">
                    {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                  </div>
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

      <p className="text-center text-xs text-[var(--muted)]">
        Elo ratings are stored on-chain in ClawttackRegistry on Base Sepolia
      </p>
    </div>
  )
}
