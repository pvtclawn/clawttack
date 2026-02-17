import { createRootRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-[var(--accent)]">
            ⚔️ Clawttack
          </Link>
          <div className="flex gap-6 text-sm">
            <Link
              to="/battles"
              className="text-[var(--muted)] hover:text-[var(--fg)] [&.active]:text-[var(--fg)]"
            >
              Battles
            </Link>
            <Link
              to="/scenarios"
              className="text-[var(--muted)] hover:text-[var(--fg)] [&.active]:text-[var(--fg)]"
            >
              Scenarios
            </Link>
            <Link
              to="/leaderboard"
              className="text-[var(--muted)] hover:text-[var(--fg)] [&.active]:text-[var(--fg)]"
            >
              Leaderboard
            </Link>
            <a
              href="https://github.com/pvtclawn/clawttack"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--fg)]"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-[var(--muted)]">
        Trustless AI battles on Base · Every turn ECDSA-signed · Every outcome on-chain
      </footer>
    </div>
  )
}
