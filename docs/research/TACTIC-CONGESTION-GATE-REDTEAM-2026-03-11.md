# Tactic Congestion Gate Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/106-TACTIC-CONGESTION-PRICE-OF-ANARCHY-GATE-PLAN-2026-03-11.md`

## Why this might fail
The proposed tactic-congestion gate can be gamed if it mostly sees surface labels, lexical variation, and shallow payoff hints. In that case, a smart attacker will optimize the **appearance of diversity** rather than real adversarial variety.

## Weaknesses identified
### 1. Tactic-label spoofing
A repetitive attack can be relabeled across adjacent families (`prompt-injection` vs `social-engineering`, `joker` camouflage, etc.) and slip past family-concentration rules.

**Risk:** the system measures declared category motion instead of actual strategic motion.

### 2. Shallow-paraphrase fake diversity
Semantically similar attacks can be rewritten with enough lexical churn to beat simple similarity thresholds while preserving the same underlying tactic shape.

**Risk:** the gate mistakes cosmetic wording churn for genuine variation.

### 3. Payoff-laundering abuse
If repeated tactics are exempted by realized payoff, agents can farm tiny or incidental gains to justify over-concentration.

**Risk:** "worked a little" becomes a loophole for keeping the boring meta dominant.

### 4. Availability-set fiction
The plan assumes unused alternatives exist. In some states, that may be false or unprovable.

**Risk:** strategically correct concentration gets penalized, pushing agents toward fake variety instead of good play.

### 5. Taxonomy collapse / over-splitting
Hybrid attacks do not fit cleanly in a one-hot family bucket. A coarse taxonomy can collapse distinct tactics together or split near-identical tactics apart.

**Risk:** both false positives and false negatives increase as attack composition gets richer.

## Proposed mitigation directions
1. **Derived tactic evidence over self-labels**
   - infer family from structured features / classifier rationale,
   - ambiguous label assignments should degrade confidence or fail closed.

2. **Strategy-shape repetition detection**
   - compare attack intent / target mechanism / pressure pattern,
   - do not rely on text similarity alone.

3. **Battle-level payoff justification**
   - repeated tactics should need strong rolling contribution, not tiny local gains.

4. **Feasibility witness for alternatives**
   - only penalize unused families when the evaluator can show viable alternatives existed.

5. **Hybrid tactic representation**
   - use primary/secondary tags or feature vectors instead of fragile one-hot family assignment.

## Concrete next tasks
### Task 1 — Tactic evidence derivation
Acceptance criteria:
- spoofed self-label fixture fails,
- ambiguous family assignment produces deterministic uncertainty / fail reason,
- identical evidence tuples produce identical artifact hash.

### Task 2 — Strategy-shape repetition guard
Acceptance criteria:
- shallow paraphrase fixture is still classified as repetitive,
- genuinely distinct tactic-shape fixture passes.

### Task 3 — Payoff + feasibility guard
Acceptance criteria:
- tiny incidental gains do not exempt repetition,
- narrow feasible-action-state fixture avoids false punishment,
- counterfactual unused-alternative claim requires explicit evidence.

## Non-overclaim caveat
This red-team pass does **not** prove the tactic-congestion direction is bad. It shows the first version will be fragile unless evidence binding and feasibility logic are stronger than the current draft.
