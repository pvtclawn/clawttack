# Degraded Verification Fallback Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/116-GRACEFUL-DEGRADED-VERIFICATION-FALLBACK-PLAN-2026-03-11.md`

## Why this might fail
The degraded-fallback layer is a necessary addition to routing, but it becomes a new optimization target. Attackers can try to manipulate **which output mode** the system returns: primary, backup, degraded fallback, or fail-closed.

## Weaknesses identified
### 1. Uncertainty laundering
Attackers can try to make hostile ambiguity look like benign budget scarcity so the system emits a degraded artifact instead of asking for richer verification or failing closed.

**Risk:** degraded output becomes a low-scrutiny route for ambiguous attacks.

### 2. Degraded-output farming
If degraded fallback is cheaper, faster, or more predictable, attackers will learn to target it deliberately.

**Risk:** the system rewards partial evidence with strategically useful but weakly checked outputs.

### 3. False-safety presentation
Degraded artifacts may still look more trustworthy than they really are, especially if caveats are visually weak or absent from machine-readable fields.

**Risk:** downstream consumers overtrust low-confidence outputs.

### 4. Budget exhaustion as an evidence shield
Attackers may deliberately exhaust backup capacity so later cases get downgraded into degraded mode.

**Risk:** the easiest route to weaker scrutiny becomes inducing scarcity first.

### 5. Candidate leakage in degraded mode
Overly informative degraded artifacts can leak the system’s uncertainty geometry and help attackers tune future cases.

**Risk:** degraded mode becomes a training oracle.

## Proposed mitigation directions
1. **Degraded-output admissibility guard**
   - allow degraded fallback only for clearly non-hostile scarcity.

2. **Degraded-mode anti-reward guard**
   - keep degraded output from becoming strategically attractive.

3. **Strong low-trust presentation semantics**
   - include explicit human/machine-readable low-trust flags.

4. **Budget-stress suspicion coupling**
   - suspicious scarcity patterns should tighten scrutiny instead of relaxing it.

5. **Candidate-leak minimization**
   - preserve auditability without turning degraded artifacts into a tuning oracle.

## Concrete next tasks
### Task 1 — Low-trust degraded-output artifact guard
Acceptance criteria:
- degraded artifact carries unmistakable low-trust semantics,
- downstream-safe fields are distinguishable from richer verification outputs.

### Task 2 — Degraded-mode admissibility + anti-reward guard
Acceptance criteria:
- uncertainty-laundering fixture cannot reach degraded mode without satisfying non-hostile scarcity conditions,
- repeated degraded-output farming is downgraded or escalated.

### Task 3 — Candidate-leak budget support
Acceptance criteria:
- degraded artifact limits explanatory detail to a configured minimum,
- over-detailed candidate leakage fixture is rejected or redacted.

## Non-overclaim caveat
This red-team pass does **not** show the degraded-fallback direction is wrong. It shows that without stronger admissibility, low-trust presentation, anti-reward policy, and candidate-leak controls, the system may evolve from **routing gaming** into **fallback gaming**.
