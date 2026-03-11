# Consumer-Segregated Output Views Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/122-CONSUMER-SEGREGATED-OUTPUT-VIEWS-PLAN-2026-03-11.md`

## Why this might fail
The consumer-segregated output-view layer is a strong direction, but it creates a new attack surface around **role semantics and cross-view consistency**. Attackers can target which role is selected, what fields drift across roles, and whether the system quietly reintroduces an oversized interface by accumulation.

## Weaknesses identified
### 1. Capability creep
Field exposure tends to expand over time as every consumer role asks for "just a little more" context.

**Risk:** narrow views slowly grow into broad ones, undoing interface segregation.

### 2. Role confusion
Adjacent roles (`research-metrics`, `operator-debug`, `internal-verifier`) can become semantically blurry.

**Risk:** field exposure becomes inconsistent and hard to review.

### 3. Cross-view field bleed
Shared serializers or nested structures can leak one role’s fields into another role’s output.

**Risk:** role boundaries become porous without obvious code changes.

### 4. View divergence
Different consumers may receive materially different interpretations of the same underlying case.

**Risk:** teams and tools stop sharing a common factual ground truth.

### 5. Authorization-by-convention
If callers choose their own role labels, richer views may be exposed by convenience rather than policy.

**Risk:** the view layer looks like policy, but acts like formatting.

## Proposed mitigation directions
1. **Explicit role taxonomy + field matrix**
   - define stable role purposes and allowed fields centrally.

2. **Single-source view compiler**
   - derive all views from one deterministic boundary.

3. **Cross-view bleed fixtures**
   - test that role-specific fields do not leak across adjacent views.

4. **Shared-origin linkage**
   - all views for the same case should share stable identity.

5. **Capability issuance separate from rendering**
   - role assignment should be a real policy decision, not a caller preference.

## Concrete next tasks
### Task 1 — Role-matrix compiler support
Acceptance criteria:
- role definitions and field matrices are explicit inputs,
- adjacent-role confusion fixture is rejected or normalized.

### Task 2 — Cross-view bleed + divergence guard
Acceptance criteria:
- field-bleed fixture fails,
- same-case views retain shared origin while preserving role-specific differences.

### Task 3 — Capability-binding guard
Acceptance criteria:
- unauthorized richer-view selection fixture is rejected,
- rendering logic cannot bypass capability assignment.

## Non-overclaim caveat
This red-team pass does **not** show the consumer-segregated output-view direction is wrong. It shows that without explicit role taxonomy, centralized compilation, bleed tests, shared identity, and real capability binding, the system may evolve from **one oversized interface** into **many drifting ones**.
