# Red-Team — v05 controlled agent battle resumption (2026-03-15 00:03 UTC)

## Trigger
Lane F critique after the decision guidance:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-CONTROLLED-AGENT-BATTLE-RESUMPTION-2026-03-14-2358.md`

Additional concrete signal:
- an exec session reported SIGTERM while the underlying smoke run had already created a real battle and mined turns.
- That is exactly the kind of ambiguity the resumed execution policy needs to handle cleanly.

## Main weaknesses identified

### 1. Supervisor/interruption ambiguity
A resumed battle can produce real on-chain progress and still end with a non-gameplay process outcome (`SIGTERM`, exec session death, tool timeout, supervisor restart).

**Why this matters:**
- process exit status alone is not a battle verdict,
- a partially successful live run can be mislabeled as a gameplay failure,
- or a noisy interrupted run can be overcounted as a proper battle just because txs exist.

**Required mitigation:**
- separate `executionOutcome` from `gameplayOutcome` in the next artifact bundle.

---

### 2. Source-of-move truth can still drift
The guidance says to preserve whether a side is gateway/OpenClaw agent, local script, or Docker ClawnJr agent — but unless that is recorded directly in artifacts, it is still easy for helper/fallback behavior to masquerade as agent play.

**Why this matters:**
- “agent-vs-script” and “agent-vs-agent” claims become soft if the authorship evidence is conversational rather than artifact-level,
- one-battle discipline does not protect against mislabeled authorship.

**Required mitigation:**
- make source-of-move metadata explicit in battle log/checkpoint/reliability note outputs.

---

### 3. Proper-battle threshold is still too easy to blur
The latest strict smoke proved parser-boundary recovery and mined many turns. That is good progress, but it is not automatically the same thing as a “proper battle” under the project’s product shape.

**Why this matters:**
- people naturally round up from “multi-turn live run” to “proper battle,”
- settlement, coherence, mode correctness, and no-fallback-authenticity are still separate criteria.

**Required mitigation:**
- define a narrow acceptance rubric for when a resumed agent-path run counts as a proper battle artifact.

---

### 4. One-battle discipline can still create lucky-run overconfidence
Running one battle at a time is the right control mechanism, but it does not remove sample bias.

**Why this matters:**
- a single clean run after a boundary fix can be unusually friendly,
- promotion from one run to mode-level confidence is still unsafe,
- especially when settlement reliability and wider gateway-output robustness remain open questions.

**Required mitigation:**
- explicitly mark the next resumed run as exploratory unless it clears the proper-battle rubric and its caveats remain narrow.

---

### 5. Failure-family mixing still threatens interpretation quality
Even with better parser handling, the evidence stack can still mix:
- infra interruption,
- parser/interface failure,
- runner bug,
- and genuine gameplay outcome.

**Why this matters:**
- mixed failure language makes the artifact look stronger than it is,
- later comparisons become untrustworthy if categories are not kept orthogonal.

**Required mitigation:**
- preserve orthogonal labels for execution/infrastructure outcome vs gameplay outcome in the next resumed run artifact.

## Strongest critique summary
The controlled resumption plan is directionally right, but it is still vulnerable to three kinds of false confidence:
1. mistaking exec/supervisor outcomes for battle outcomes,
2. mistaking labeled intent for source-of-move proof,
3. mistaking multi-turn liveness for a proper battle verdict.

## Best next fixes called out
1. add explicit `executionOutcome` vs `gameplayOutcome` accounting for the next resumed run,
2. persist source-of-move truth in artifact outputs,
3. define a narrow proper-battle acceptance rubric before counting the next resumed run as success.

## What this critique does **not** say
- It does **not** argue against resuming agent battle mode work.
- It does **not** say the parser fix was weak.
- It says the next resumed run needs tighter classification to be counted honestly.

## On-chain classification
- No new tx justified for this challenge lane.
- This lane tightens evaluation criteria for the next live run; it does not itself create a new gameplay artifact.
