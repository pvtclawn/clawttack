# Output Oracle-Resistance Gate Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/118-OUTPUT-ORACLE-RESISTANCE-GATE-PLAN-2026-03-11.md`

## Why this might fail
The oracle-resistance layer is necessary, but it becomes a new optimization target. Attackers can try to infer verifier state not from rich details, but from the **remaining coarse structure** of public-safe, redacted, and blocked outputs.

## Weaknesses identified
### 1. Coarse-grained leakage still leaks
Even when exact counters, rankings, and traces are hidden, output mode, field presence, artifact length, and caveat style can still reveal useful verifier-state information.

**Risk:** attackers learn boundary behavior without needing precise internals.

### 2. Over-redaction hurts honest auditability
If too much detail is removed, legitimate debugging and mechanism tuning become harder while attackers still learn from repeated coarse outcome differences.

**Risk:** observability is lost without actually eliminating the oracle.

### 3. Correlated-field route inference
Hidden route state can often be reconstructed from surviving field combinations, ordering, and mode-dependent metadata.

**Risk:** the system hides explicit traces but still leaks them indirectly.

### 4. Redaction-threshold gaming
Fixed detail-budget thresholds can be probed and learned.

**Risk:** attackers tune cases to stay just inside public-safe output bands or intentionally trigger predictable redaction patterns.

### 5. Stable redacted artifacts as feedback channels
Deterministic redaction helps replayability, but repeated stable outputs across small input changes can become a strong probing oracle.

**Risk:** attackers compare near-neighbor cases to infer which hidden features matter.

## Proposed mitigation directions
1. **Mode-normalized public surface**
   - reduce unnecessary structural differences across public-safe/redacted outputs.

2. **Dual-surface design**
   - separate attacker-visible/public artifacts from richer audit-visible artifacts.

3. **Correlation-aware redaction review**
   - test combinations of surviving fields, not just individual field exposure.

4. **Threshold smoothing / banding**
   - avoid brittle detail-budget boundaries with obvious public transitions.

5. **Oracle-probe fixtures**
   - test repeated near-neighbor inputs for public-output leakage.

## Concrete next tasks
### Task 1 — Mode-normalized public artifact support
Acceptance criteria:
- public-safe and redacted artifacts share normalized field ordering/shape where possible,
- coarse mode leakage fixture is reduced.

### Task 2 — Correlation-aware oracle probe guard
Acceptance criteria:
- correlated-field route-inference fixture is redacted or normalized,
- repeated near-neighbor probe fixture exposes limited incremental information.

### Task 3 — Dual-surface output policy
Acceptance criteria:
- public artifact stays minimal and normalized,
- richer audit artifact retains needed detail without leaking to the public surface.

## Non-overclaim caveat
This red-team pass does **not** show the oracle-resistance direction is wrong. It shows that without mode normalization, correlation-aware review, threshold smoothing, and dual-surface policy, the system may evolve from **rich verifier leakage** into **coarse but still useful verifier leakage**.
