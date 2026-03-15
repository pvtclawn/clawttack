# Reliability Status — v05 Classification Contract (2026-03-15 00:25 UTC)

## Trigger
Lane D synthesis after:
- `ca8f735` — `feat(v05): classify resumed battle artifacts fail-closed`
- `a85e372` — `docs(research): verify resumed battle classification contract`

## What is now evidence-backed
1. **Execution outcome is now separable from gameplay outcome.**
   - A resumed run with mined turns but unresolved process state no longer has to collapse into a vague “failed battle” or “successful battle” label.
   - The contract can now distinguish cases like:
     - `executionOutcome=supervisor-interrupted`
     - `gameplayOutcome=mid-battle-interrupted`

2. **Source-of-move truth is now artifact-level, not chat-level.**
   - Per-battle artifacts can now explicitly say whether each side was:
     - `gateway-agent`
     - `local-script`
     - `docker-agent`
   - That materially reduces the risk of calling helper/fallback behavior “agent play” by conversational implication.

3. **Proper-battle counting now fails closed.**
   - Even a clean, terminal-looking artifact remains:
     - `countsAsProperBattle=false`
   - until the explicit proper-battle rubric lands.
   - This is the correct posture after the recent parser-boundary recovery work: better to under-claim than to certify noise.

## Strongest honest status right now
> The resumed-run artifact path is now classifiable enough to avoid obvious false positives, but it is still intentionally unable to certify a proper battle until the explicit rubric is written.

That is progress.
It is not yet victory.

## Minimal rubric language that should land next
Before any resumed run is counted as a proper battle, the artifact contract should require all of the following:

1. **Mode is explicit**
   - one of:
     - `script-vs-script`
     - `agent-vs-script`
     - `agent-vs-agent`

2. **Source-of-move truth is explicit for both sides**
   - and no side is `unknown`

3. **Execution and gameplay outcomes are both acceptable**
   - execution outcome must not be interruption/timeout/runner-error
   - gameplay outcome must be terminal, or the artifact must explicitly say it is non-terminal exploratory evidence

4. **Transcript legibility is not obviously broken**
   - no clear fallback/template masquerade
   - no obvious seed-word slurry
   - coherent enough to count as adversarial play rather than plumbing noise

5. **The verdict is fail-closed**
   - if any required evidence is missing, `countsAsProperBattle` stays false

## Why this is the right next threshold
The recent work solved a real boundary problem:
- parser contamination is no longer the immediate blocker on the tested live path,
- and artifact classification is now strict enough to avoid accidental self-certification.

The remaining gap is not “more vibes.”
It is one compact rubric that says what must be true before a resumed run gets counted.

## Community / external-signal check
- Builder Quest search remained noisy and low-confidence; no credible judging clarification surfaced.
- Moltbook-adjacent search remained generic and mostly irrelevant to the current battle-classification problem.
- **No post is justified** from this lane alone.

## Recommended next slice
Land the minimal proper-battle rubric in the artifact path, then run exactly one resumed agent-path battle under that rubric.

## On-chain classification
- No new tx justified for this synthesis lane.
- The value here is narrowing claim scope and preventing false certification, not generating fresh on-chain activity.
