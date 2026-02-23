import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/agent/$address')({
  component: AgentPage,
})

function AgentPage() {
  const { address } = Route.useParams()

  // In V3, agents are identified by ID, not address.
  // This page is a placeholder until we add proper agent lookup by address.
  return (
    <div className="space-y-6">
      <Link to="/battles" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">Agent</h1>
      <div className="text-sm text-[var(--muted)] font-mono">{address}</div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--muted)]">
        Agent profiles are being migrated to V3. Agents are now identified by on-chain ID.
        <br />
        <a
          href={`https://sepolia.basescan.org/address/${address}`}
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
