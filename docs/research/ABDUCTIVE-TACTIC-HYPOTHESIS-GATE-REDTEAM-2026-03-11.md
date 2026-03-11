# Abductive Tactic-Hypothesis Gate Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/110-ABDUCTIVE-TACTIC-HYPOTHESIS-GATE-PLAN-2026-03-11.md`

## Why this might fail
The abductive tactic-hypothesis design is a better fit than direct label trust, but it creates a new optimization target: attackers can manipulate the **relative ranking of explanations** rather than the final label directly.

## Weaknesses identified
### 1. Hypothesis-padding abuse
Attackers can add decorative cues for multiple tactic families so the candidate set gets crowded and unstable.

**Risk:** nearly identical attacks can oscillate between clean pass and ambiguous because the ranking margin is being gamed rather than earned.

### 2. Contradiction laundering
Supportive and contradictory cues can be mixed so a favored family remains competitive even when strong evidence points against it.

**Risk:** contradictions get diluted instead of decisively reducing confidence.

### 3. Margin-gaming around ambiguity thresholds
A fixed explanation-margin threshold can be targeted directly.

**Risk:** attackers either farm ambiguity to avoid strong classification or nudge false certainty by barely clearing the threshold.

### 4. Candidate-family blind spot
Finite/coarse tactic families can force a misleading best-fit verdict when the real attack is hybrid or outside taxonomy.

**Risk:** the gate mistakes "least bad explanation" for "good explanation." 

### 5. Explanation provenance opacity
If the artifact hides alternative hypotheses and contradiction structure, downstream consumers may overtrust the winner.

**Risk:** a brittle or manipulated verdict looks stronger than it really is.

## Proposed mitigation directions
1. **Hypothesis-density guard**
   - detect suspiciously broad low-confidence support spread across non-winning families.

2. **Contradiction-weight floor**
   - ensure strong contradiction evidence can force `tactic-hypothesis-contradicted`.

3. **Margin semantics richer than one threshold**
   - distinguish clean wins from threshold-hugging wins with dense alternative support.

4. **Unknown / no-fit fallback**
   - when no explanation is good enough, fail to weak-support/unknown rather than forcing a family.

5. **Explanation trace artifact**
   - preserve top candidates, support, contradiction, and margin for replayable review.

## Concrete next tasks
### Task 1 — Density + contradiction-aware abductive scorer
Acceptance criteria:
- hypothesis-padding fixture degrades verdict or margin as expected,
- contradiction-heavy fixture fails with `tactic-hypothesis-contradicted`,
- identical candidate sets produce identical artifact hash.

### Task 2 — Threshold-gaming guard
Acceptance criteria:
- threshold-hugging ambiguity-farming fixture is distinguishable from clean close-call ambiguity,
- threshold-hugging false-certainty fixture is rejected or downgraded.

### Task 3 — No-fit / explanation-trace support
Acceptance criteria:
- hybrid/no-good-fit fixture fails to weak-support or unknown-style outcome,
- artifact preserves top-candidate explanation trace with stable ordering.

## Non-overclaim caveat
This red-team pass does **not** show the abductive direction is wrong. It shows that without density, contradiction, threshold-gaming, and no-fit handling, the gate may evolve from **label theater** into **hypothesis theater**.
