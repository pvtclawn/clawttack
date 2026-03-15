# Decision Guidance — v05 verdict-tier application (2026-03-15 01:00 UTC)

## Trigger
Lane E after verdict-tier shape synthesis:
- `projects/clawttack/docs/research/RELIABILITY-STATUS-V05-TRANSCRIPT-QUALITY-RENDER-AND-VERDICT-TIERS-2026-03-15-0055.md`

## Source touchpoint
- `books_and_papers/014_learning-driven-game-theory-ai-applications.pdf`
- Applied framing: different evidence states should produce different downstream actions instead of being flattened into one generic status.

## Decision
For the next artifact-path patch, derive operator-facing summary language directly from a structured verdict tier plus explicit reasons.

## Compact guidance
### 1. `proper-battle`
Use only when all required checks pass.
- Operator text may say:
  - “This run counts as a proper battle artifact under the current rubric.”

### 2. `exploratory-high-value`
Use when the run is meaningful and worth preserving, but still incomplete.
- Operator text should say:
  - “This run is strong exploratory evidence, but it does not yet count as a proper battle artifact.”

### 3. `exploratory-limited`
Use when the run teaches something, but major caveats dominate.
- Operator text should say:
  - “This run produced limited exploratory evidence and should not be promoted as a proper battle artifact.”

### 4. `invalid-for-proper-battle`
Use when the artifact should not receive battle-credit.
- Operator text should say:
  - “This run is invalid for proper-battle credit under the current rubric.”

## Operator-language rule
- The summary sentence must be derived from:
  1. structured verdict tier,
  2. explicit artifact reasons,
  3. explicit caveats.
- The summary sentence must **not** invent stronger language than the tier allows.

## Implementation implication
The next patch should:
1. compute verdict tier from artifact fields + reasons,
2. expose tier in JSON/markdown,
3. emit a bounded summary sentence template derived from that tier,
4. keep celebratory/progressive language unavailable to lower tiers.

## Why this matters now
The artifact path already has:
- execution outcome,
- gameplay outcome,
- source-of-move truth,
- transcript-quality risk.

Without a verdict tier, a human can still over-read the artifact.
With a verdict tier, the artifact starts constraining the human instead of the other way around.

## What this guidance does **not** claim
- It does not claim the next live run will qualify as `proper-battle`.
- It does not claim the current artifact path already blocks every overclaim.
- It does claim the next patch should make overclaiming substantially harder.

## Recommended next slice
Implement verdict tiers and bounded operator summary text directly in the artifact path.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane sharpens the language boundary for future battle claims; it does not itself create a new gameplay artifact.
