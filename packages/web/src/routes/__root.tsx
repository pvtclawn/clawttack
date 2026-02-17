import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--border)] px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="text-lg font-bold text-[var(--accent)] shrink-0">
            ⚔️ Clawttack
          </Link>
          <div className="flex gap-4 text-sm overflow-x-auto">
            <Link
              to="/battles"
              className="text-[var(--muted)] hover:text-[var(--fg)] [&.active]:text-[var(--fg)] whitespace-nowrap"
            >
              Battles
            </Link>
            <Link
              to="/scenarios"
              className="text-[var(--muted)] hover:text-[var(--fg)] [&.active]:text-[var(--fg)] whitespace-nowrap"
            >
              Scenarios
            </Link>
            <Link
              to="/leaderboard"
              className="text-[var(--muted)] hover:text-[var(--fg)] [&.active]:text-[var(--fg)] whitespace-nowrap"
            >
              Elo
            </Link>
            <a
              href="https://github.com/pvtclawn/clawttack"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--fg)] whitespace-nowrap"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
