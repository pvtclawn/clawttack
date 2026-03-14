# Applied Lessons — v05 Single-Variable Variation (2026-03-14 03:09 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/007_building_agentic_ai.pdf`
- Focused ideas: controlled evaluation loops, baseline vs intervention comparison, one-variable changes, interpretable experiment design.

## Why this source is relevant
The project has now completed:
- same-regime live smoke,
- first low-volume scouting batch,
- second low-volume scouting batch,
- comparison-aware summaries.

That means the next learning step should not be another identical replication by default. It should be a **small, legible intervention** that can expose mechanics the baseline batches still did not reach.

## Applied lessons

### 1) Vary one thing at a time
If the next batch changes multiple variables, the comparison loses explanatory value.

**Applied rule:** the next batch should introduce exactly one explicit intervention.

### 2) Treat the current scouting regime as the control
The baseline is now clear enough to compare against.

**Applied rule:** the next batch summary should explicitly name the baseline and the intervention.

### 3) Prefer interventions that target missing mechanics
The key evidence gap is later-turn / settlement / active-poison visibility.

**Applied rule:** choose a variation that increases the chance of observing those mechanics without rewriting the whole regime.

### 4) Keep the intervention small enough to remain interpretable
The goal is not novelty for its own sake.

**Applied rule:** prefer a modest single-parameter change (or one instrumentation tweak) over a broad configuration rewrite.

### 5) The artifact layer must encode the intervention label
Otherwise the batch comparison is still too easy to narrativize loosely.

**Applied rule:** the next batch should carry an explicit intervention label in its summaries.

## Best next intervention candidate
Smallest useful intervention:
- keep the same identity pair / stake / warmup / general flow,
- modestly increase `CLAWTTACK_MAX_TURNS`,
- label the run clearly (e.g. `max-turns-12`),
- compare observed/unobserved mechanics against the baseline batch.

## Explicit caveat
This note does **not** claim that a higher turn cap will solve or reveal everything. It narrows the next experiment to something cleanly comparable and more likely to surface the missing later-turn mechanics.
