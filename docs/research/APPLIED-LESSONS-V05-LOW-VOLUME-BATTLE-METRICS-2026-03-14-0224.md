# Applied Lessons — v05 Low-Volume Battle Metrics (2026-03-14 02:24 UTC)

## Trigger
Heartbeat Lane E (LEARN).

## Source
- `books_and_papers/007_building_agentic_ai.pdf`
- Focused ideas: evaluation loops, observability, failure-mode accounting, disciplined interpretation of small samples.

## Why this source is relevant
v05 now has real on-chain turns. That means the next task is not more abstract debugging for its own sake—it is collecting **useful** low-volume battle data without overclaiming from a tiny sample.

## Applied lessons

### 1) The next batch is a scouting run, not a verdict
A few battles are enough to expose failure classes and obvious behavior patterns, but not enough for strong conclusions about the final game.

**Applied rule:** label the next run as low-volume exploratory collection.

### 2) Failure-stage counts are as important as battle outcomes
Create/accept/submit/reveal/settle failures are first-class metrics.

**Applied rule:** count and summarize stage-specific failures rather than burying them in logs.

### 3) Per-battle summaries should preserve the causal trail
Each battle needs enough structure to explain what happened without replaying the entire raw log.

**Applied rule:** record per battle:
- battle id/address,
- stage reached,
- turn count,
- tx hashes,
- bank deltas,
- failure class or settlement result.

### 4) Use a compact metric bundle, not one headline number
At this stage, wins/losses alone are too shallow.

**Applied rule:** track a small bundle:
- turns reached,
- settlement/result type,
- bank depletion pattern,
- NCC/VOP usage hints,
- failure-stage histogram.

### 5) Scale only after one controlled batch is interpretable
Now that turns mine, volume should still increase cautiously.

**Applied rule:** run a low-volume batch first (e.g. 3–5 battles), inspect artifacts, then decide whether to scale higher while Egor still sleeps.

## Concrete next build/verify contract
The next collection slice should:
1. run a low-volume batch,
2. emit explicit per-battle summaries,
3. aggregate stage/result metrics into one concise artifact,
4. only then consider higher battle count.

## Explicit caveat
This note does **not** claim that a small batch will tell us whether v05 gameplay is definitively good. It will tell us whether the new live path is stable enough to trust the next scale step and which failure classes dominate first.
