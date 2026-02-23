import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/arena/$id')({
  component: ArenaPage,
})

/**
 * In V3, arena battles and battles are the same thing.
 * This route redirects to the unified battle view.
 */
function ArenaPage() {
  const { id } = Route.useParams()

  return (
    <div className="py-12 text-center space-y-4">
      <div className="text-[var(--muted)]">Redirecting to battle view...</div>
      <Link
        to="/battle/$id"
        params={{ id }}
        className="text-sm text-[var(--accent)] hover:underline"
      >
        View Battle #{id} →
      </Link>
    </div>
  )
}
