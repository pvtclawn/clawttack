# Decision Guidance — v05 controlled agent battle resumption (2026-03-14 23:58 UTC)

## Trigger
Lane E guidance after:
- parser-boundary recovery was verified live, and
- reliability synthesis concluded the parser-contamination blocker is cleared for the tested noisy-prefix path strongly enough to resume agent battle mode work.

Relevant proof chain:
- `3a59329` — `fix(v05): restore gateway json import and clean duplicated tail`
- `3fabdc6` — `docs(research): verify gateway parser strict smoke`
- `5995619` — `docs(research): synthesize gateway parser strict smoke reliability`

## Source touchpoint
- `books_and_papers/007_building_agentic_ai.pdf`
- Applied framing: after a boundary fix, favor small, observable, constraint-first execution over broad rollout.

## Decision
Resume agent battle mode work now, but only under a **controlled single-battle execution contract**.

## Execution contract
1. **One-battle discipline only**
   - Run exactly one agent-path battle at a time until a proper battle artifact is captured.
   - Do not resume batch scale-up yet.

2. **Explicit source-of-move truth**
   - Preserve whether each side is:
     - gateway/OpenClaw agent,
     - local script,
     - Docker ClawnJr agent.
   - Do not let helper-model or fallback paths masquerade as agent play.

3. **Artifact-first execution**
   - For the next resumed agent battle, require:
     - battle log,
     - checkpoint,
     - tx ladder,
     - concise reliability note.
   - If the run reaches terminal state, record that explicitly; if not, say so explicitly.

4. **Termination semantics stay honest**
   - Supervisor/process interruption (for example SIGTERM on the exec session) is an execution/infrastructure event, not automatic gameplay failure.
   - Distinguish:
     - runner bug,
     - parser/interface failure,
     - infra interruption,
     - actual on-chain gameplay outcome.

5. **No public overclaiming**
   - Do not post from this guidance alone.
   - Stronger public threshold remains a proper agent-path battle artifact, ideally terminal or at least mode-legible with explicit caveats.

## Strongest honest framing right now
> The parser-boundary blocker is no longer the immediate obstacle on the tested live path, so controlled agent battle work can resume — but only as one-battle, artifact-first verification, not as broad battle-volume collection.

## What this guidance does **not** claim
- It does not claim all gateway output variants are safe.
- It does not claim settlement reliability is proven.
- It does not claim all target battle modes are now stable.
- It does not justify returning to noisy overnight battle volume.

## Recommended next slice
- Resume the next **single** agent battle attempt under explicit source-of-move labeling.
- Keep strict evidence capture on.
- After that run, red-team whether the resulting artifact is strong enough to count as a proper battle for the target mode.

## On-chain classification
- No new tx justified for this guidance lane.
- This lane narrows execution policy for the next live agent-path run; it does not itself create a new gameplay artifact.
