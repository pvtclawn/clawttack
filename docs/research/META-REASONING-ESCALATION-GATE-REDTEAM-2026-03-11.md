# Meta-Reasoning Escalation Gate Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/112-META-REASONING-ESCALATION-GATE-PLAN-2026-03-11.md`

## Why this might fail
The escalation controller is a necessary layer, but it becomes a new optimization target. Attackers can try to manipulate **which control path** the system chooses: cheap acceptance, deeper verification, or fail-closed.

## Weaknesses identified
### 1. Escalation farming
An attacker can keep diagnostics in the "mixed but salvageable" band so the system repeatedly asks for deeper verification.

**Risk:** uncertainty becomes a resource-drain attack instead of a bounded diagnostic state.

### 2. Fail-closed griefing
If fail-closed triggers are too permissive, attackers can spam malformed or contradiction-flavored inputs to force denial of useful work.

**Risk:** safety is preserved, but liveness collapses under adversarial noise.

### 3. Threshold manipulation
Fixed thresholds can be gamed from both directions.

**Risk:** attackers either forge cheap-path eligibility by barely staying under escalation thresholds, or keep the system from ever accepting the cheap path by hugging the escalation band.

### 4. Diagnostic provenance blind spot
Upstream diagnostics vary in reliability. If the controller treats them as equivalent, noisy or weak signals can dominate control decisions.

**Risk:** escalation decisions become brittle, inconsistent, or manipulable.

### 5. Escalation outcome opacity
If only the terminal control action is preserved, later consumers lose visibility into the thresholds and diagnostics that caused it.

**Risk:** repeated expensive/blocked paths become hard to audit or tune.

## Proposed mitigation directions
1. **Escalation-debt accounting**
   - repeated deeper-verification outcomes should accumulate actor/context debt.

2. **Stronger fail-closed admissibility**
   - require stronger evidence for fail-closed than for ordinary ambiguity.

3. **Hysteretic / multi-band control policy**
   - avoid one brittle cutoff per action; distinguish clean, mixed, and hostile bands more robustly.

4. **Diagnostic confidence weighting**
   - weight upstream signals by provenance/confidence class.

5. **Decision-trace artifact**
   - preserve thresholds, triggering diagnostics, and debt state in the artifact.

## Concrete next tasks
### Task 1 — Control-path debt + trace support
Acceptance criteria:
- escalation-farming fixture increases debt deterministically,
- artifact preserves triggering metrics + debt state.

### Task 2 — Fail-closed admissibility guard
Acceptance criteria:
- benign incompleteness does not trip fail-closed,
- contradiction/version-risk griefing fixture triggers fail-closed only with stronger evidence.

### Task 3 — Confidence-weighted threshold policy
Acceptance criteria:
- low-confidence diagnostics cannot outweigh high-confidence contradiction/version signals,
- threshold-hugging cheap-path forgery fixture is rejected or escalated.

## Non-overclaim caveat
This red-team pass does **not** show the escalation-gate direction is wrong. It shows that without debt handling, fail-closed admissibility controls, confidence weighting, and decision-trace transparency, the system may evolve from **classifier gaming** into **controller gaming**.
