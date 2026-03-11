# Dual-Surface Output Contract Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/120-DUAL-SURFACE-OUTPUT-CONTRACT-PLAN-2026-03-11.md`

## Why this might fail
The dual-surface contract is a strong design direction, but it creates a new attack surface: the boundary between public and audit outputs. Attackers can target **how the two surfaces diverge, correlate, and evolve**.

## Weaknesses identified
### 1. Contract drift over time
Public and audit surfaces may evolve asymmetrically, leaving stale allowlists or ambiguous semantics.

**Risk:** new internal fields or changed meanings leak to the public surface by accident.

### 2. Accidental field bleed
Nested metadata, debug helpers, or shared serializers can leak audit-only fields into the public contract.

**Risk:** the public API silently stops being minimal.

### 3. Public/audit divergence abuse
If the two surfaces are not visibly linked to the same underlying decision, mismatches can be exploited.

**Risk:** downstream trust splits between two inconsistent interpretations of the same case.

### 4. Contract-shape inference
Even with field allowlists, differences in field presence, ordering, or nullability can leak hidden route/verifier state.

**Risk:** attackers infer audit-side conditions from public artifact shape.

### 5. Translation-layer sprawl
If the public/audit boundary is enforced in multiple helpers or renderers, policy becomes hard to review and regressions become easy.

**Risk:** contract separation exists on paper but not as a single trustworthy boundary.

## Proposed mitigation directions
1. **Single-source translation boundary**
   - derive both surfaces from one deterministic contract compiler.

2. **Field-bleed fixtures**
   - explicitly test that audit-only fields never appear publicly.

3. **Linked artifact identity**
   - public and audit artifacts should share stable identity proving common origin without leaking hidden detail.

4. **Shape normalization**
   - stabilize field presence/order/nullability across the public surface.

5. **Contract-drift review gates**
   - every new field should require an explicit visibility-policy decision.

## Concrete next tasks
### Task 1 — Centralized contract compiler + identity linkage
Acceptance criteria:
- public and audit artifacts are produced from one deterministic boundary,
- linked identity proves common origin without leaking audit-only detail.

### Task 2 — Field-bleed + drift guard
Acceptance criteria:
- nested audit-only field bleed fixture fails,
- new-field drift fixture requires explicit visibility policy.

### Task 3 — Shape-normalization guard
Acceptance criteria:
- structural inference fixture is reduced by stable field ordering/presence rules,
- public and audit divergence on the same case is detectable.

## Non-overclaim caveat
This red-team pass does **not** show the dual-surface contract direction is wrong. It shows that without centralized translation, field-bleed tests, linkage, and drift controls, the system may evolve from **public leakage** into **contract-boundary leakage**.
