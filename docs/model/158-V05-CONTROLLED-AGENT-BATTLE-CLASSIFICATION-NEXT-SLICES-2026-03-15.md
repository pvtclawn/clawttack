# 158 — v05 controlled agent-battle classification next slices (2026-03-15)

## Trigger
Lane A planning after:
- `projects/clawttack/docs/research/DECISION-GUIDANCE-V05-CONTROLLED-AGENT-BATTLE-RESUMPTION-2026-03-14-2358.md`
- `projects/clawttack/docs/research/REDTEAM-V05-CONTROLLED-AGENT-BATTLE-RESUMPTION-2026-03-15-0003.md`

## Problem statement
The parser-boundary blocker is now cleared for the tested live path strongly enough to resume controlled agent battle work, but the next resumed run is still too easy to misclassify.

Current risk:
- exec/supervisor interruption can be mistaken for gameplay failure,
- source-of-move truth can remain conversational rather than artifact-level,
- multi-turn liveness can be overcounted as a proper battle,
- and mixed infra/parser/runner/gameplay outcomes can blur the final verdict.

## Planned tasks

### Task 1 (P0): explicit battle-artifact classification contract
Add explicit artifact fields for the next resumed run so execution and gameplay are not conflated.

#### Required fields
- `executionOutcome`
  - examples: `clean-exit`, `sigterm`, `timeout`, `runner-error`, `supervisor-interrupted`
- `gameplayOutcome`
  - examples: `terminal`, `non-terminal`, `pre-submit-failure`, `mid-battle-interrupted`, `unknown`
- `sourceOfMove`
  - per side, explicit and artifact-level:
    - `gateway-agent`
    - `local-script`
    - `docker-agent`
- `countsAsProperBattle`
  - boolean, derived from an explicit rubric rather than inferred from optimism
- `properBattleReasons[]`
  - deterministic reasons when false/true

#### Acceptance criteria
- the next resumed battle artifact can distinguish process/interruption status from on-chain battle status,
- source-of-move truth is written into artifacts, not only described in chat/docs,
- no resumed run can silently self-upgrade from “interesting live run” to “proper battle.”

---

### Task 2 (P0): narrow proper-battle acceptance rubric
Define the minimum bar for counting the next resumed run as a proper battle artifact.

#### Proposed rubric dimensions
1. correct target mode is explicit,
2. source-of-move truth is explicit for both sides,
3. transcript is coherent enough to be legible,
4. no fallback/helper masquerade is detected,
5. battle reaches a meaningful on-chain stage,
6. terminal state is preferred but not silently assumed.

#### Acceptance criteria
- rubric is written as an explicit checklist or machine-readable rule set,
- non-terminal but promising runs cannot be mislabeled as full success,
- artifact language stays fail-closed when evidence is incomplete.

---

### Task 3 (P1 gate): one resumed single-battle verification under the new contract
After Tasks 1–2 land, run exactly one resumed agent-path battle and judge it against the explicit classification contract.

#### Acceptance criteria
- artifact bundle includes battle log, checkpoint, tx ladder, execution/gameplay classification, and source-of-move truth,
- final note explicitly says whether the run counts as a proper battle,
- no battle-volume increase is allowed unless this one-battle artifact is classified cleanly and honestly.

## Priority order
1. **Task 1 first** — because execution vs gameplay separation is the smallest blocker to honest counting.
2. **Task 2 second** — because the contract needs an explicit fail-closed success bar.
3. **Task 3 third** — because the next live run should be judged by the new rubric, not vibes.

## Strongest honest framing
The next goal is not “run another battle and hope.”
The next goal is: **make the next resumed agent-path battle classifiable enough that we can honestly say whether it was a proper battle or not.**

## Explicit caveat
This roadmap does not claim agent battle mode is already stable.
It narrows the next work so the next resumed run can be evaluated without conflating infrastructure noise, runner behavior, and gameplay truth.

## Next Task
- Lane B: implement Task 1 only — add explicit battle-artifact classification fields (`executionOutcome`, `gameplayOutcome`, `sourceOfMove`, `countsAsProperBattle`, `properBattleReasons[]`) in the next resumed-run artifact path before running another counted battle.
