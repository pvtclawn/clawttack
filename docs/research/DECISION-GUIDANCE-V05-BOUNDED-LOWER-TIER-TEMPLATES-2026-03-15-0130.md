# Decision Guidance — v05 bounded lower-tier templates (2026-03-15 01:30 UTC)

## Trigger
Lane E after lower-tier template shape synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-HARD-INVALID-LAYER-AND-LOWER-TIER-TEMPLATES-2026-03-15-0125.md`

## Source touchpoint
- `books_and_papers/014_learning-driven-game-theory-ai-applications.pdf`
- Applied framing: wording is part of the action boundary when categories determine what operators do next.

## Decision
For the next artifact-path patch, implement bounded lower-tier summary templates that keep non-credit language and at least one caveat adjacent to the verdict sentence.

## Compact guidance
### `exploratory-high-value`
Use only when the run is not invalid and still worth preserving.

**Required summary template:**
> This run is exploratory evidence only and does not count as a proper battle artifact; main caveat: `<top_reason>`.

**Rules:**
- no prestige adjectives,
- non-credit language must remain in the same sentence,
- `<top_reason>` must come from structured artifact reasons.

### `exploratory-limited`
Use when the run is usable but caveat-heavy.

**Required summary template:**
> This run produced limited exploratory evidence and does not count as a proper battle artifact; main caveat: `<top_reason>`.

**Rules:**
- keep tone procedural,
- no upbeat qualifiers,
- `<top_reason>` must come from structured artifact reasons.

### `invalid-for-proper-battle`
Hard-invalid layer already forces this tier when trigger conditions are met.

**Required summary template:**
> This run is invalid for proper-battle credit under the current rubric; main trigger: `<top_invalid_trigger>`.

**Rules:**
- do not soften the invalidation,
- do not append optimistic spin,
- `<top_invalid_trigger>` must come from structured hard invalid triggers.

## Operator-language rule
- Below `proper-battle`, summary text must be:
  1. non-credit,
  2. caveat-adjacent,
  3. reason-derived,
  4. non-promotional.

## Implementation implication
The next patch should:
1. compute top reason / top invalid trigger,
2. emit bounded lower-tier summary text from structured templates,
3. keep any richer prose outside the verdict sentence,
4. make the artifact safe to quote without accidental hype.

## What this guidance does **not** claim
- It does not claim the lower-tier templates are enough by themselves.
- It does not claim the full tier-to-reason mapping is already implemented.
- It does claim the next patch should make non-top verdict language materially harder to abuse.

## Recommended next slice
Implement bounded lower-tier summary templates directly in the artifact path, then verify they render with adjacent caveats from structured reasons.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane tightens the wording boundary for future battle artifacts; it does not itself create a new gameplay artifact.
