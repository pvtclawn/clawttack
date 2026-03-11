# 106 — Tactic Congestion + Price-of-Anarchy Gate Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/014_learning-driven-game-theory-ai-applications.pdf`
- Chapter 7: Wardrop equilibrium, system optimum, and inefficiency under selfish routing.

## Problem
Clawttack has a recognizable boring-equilibrium risk:
- agents discover one or two cheap tactic families,
- they overuse them because local payoff is good enough,
- battle logs become repetitive,
- global narrative quality degrades even if turn legality and liveness remain intact.

This is structurally similar to Wardrop user equilibrium vs system optimum:
- **user equilibrium:** each side keeps choosing the locally cheapest tactic route,
- **system optimum:** overall battle output minimizes total narrative / predictability cost,
- **Price of Anarchy:** gap between these two regimes.

## Proposed mechanism/runtime delta
Introduce a deterministic **tactic-congestion gate** that scores recent tactic concentration and detects when local tactic selfishness is pushing the battle away from system optimum.

### Inputs
For a rolling battle window (for example, last 8-12 attacks):
- normalized tactic family labels
  - `prompt-injection`
  - `ctf-lure`
  - `dos-noise`
  - `social-engineering`
  - `joker`
  - `other`
- per-family frequency
- max streak length per family
- semantic similarity against recent attack texts
- optional realized-payoff signal (did the repeated tactic actually produce pressure?)

### Deterministic outputs
Proposed reason codes:
- `tactic-congestion-pass`
- `tactic-family-overconcentrated`
- `tactic-repeat-streak-risk`
- `tactic-semantic-repetition-risk`
- `tactic-selfish-equilibrium-detected`

### Core rule shape
A battle window should fail or warn when all of the following hold:
1. one tactic family dominates above a configured share threshold,
2. repetition is not offset by materially distinct semantic content,
3. realized payoff does not justify the concentration,
4. alternative tactic families are available but unused.

## Acceptance criteria
Task-1 should be considered complete when:
1. a protocol-scope evaluator deterministically classifies recent tactic windows into pass / warning / fail reasons,
2. identical tactic-window inputs always produce the same artifact hash,
3. fixtures cover:
   - healthy mixed-tactic window => `tactic-congestion-pass`
   - one-family spam => `tactic-family-overconcentrated`
   - semantically near-duplicate streak => `tactic-semantic-repetition-risk`
   - dominance without payoff justification => `tactic-selfish-equilibrium-detected`
4. `bun test` for the slice passes,
5. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** wire runtime penalties into production scoring in the first slice,
- do **not** claim this proves narrative quality,
- do **not** treat tactic diversity alone as a win signal.

## Why this matters
The point is not to punish repetition for style reasons. The point is to prevent a cheap local optimum from becoming the stable meta. If the mechanism cannot resist tactic congestion, it will drift toward readable-looking liveness with strategically dead output.

## Next Task
Lane F: red-team the tactic-congestion gate for tactic-label spoofing, fake diversity through shallow paraphrase, and payoff-laundering abuse.
