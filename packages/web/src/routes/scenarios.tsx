import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/scenarios')({
  component: ScenariosPage,
})

function ScenariosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scenarios</h1>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
        V3 uses a unified battle format with Verifiable Oracle Primitives (VOPs).
        <br />
        Each battle has linguistic challenges + cryptographic puzzles.
        <br /><br />
        <Link to="/battles" className="text-[var(--accent)] hover:underline">
          View active battles →
        </Link>
      </div>
    </div>
  )
}
