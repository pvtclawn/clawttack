# Capability-Bound Output Views Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/124-CAPABILITY-BOUND-OUTPUT-VIEWS-PLAN-2026-03-11.md`

## Why this might fail
Capability binding is a stronger boundary than caller-selected roles, but it creates a new optimization target: the **policy binding itself**. Attackers can probe how capabilities, requested roles, and context restrictions interact.

## Weaknesses identified
### 1. Capability confusion
Adjacent capabilities may overlap or be semantically blurry.

**Risk:** field exposure depends on interpretation instead of crisp policy structure.

### 2. Downgrade abuse
Downgrading richer-than-allowed requests can leak policy shape.

**Risk:** callers learn which richer roles almost worked and map the policy boundary.

### 3. Policy-shadowing loopholes
When multiple policy inputs interact, evaluation order may create accidental permissiveness.

**Risk:** a broader rule shadows a stricter one and richer views slip through.

### 4. Capability reuse drift
Capabilities issued for one context may get reused in broader contexts than intended.

**Risk:** stale assumptions keep granting too much view access over time.

### 5. Denial-surface leakage
Detailed downgrade/deny semantics can become a policy oracle.

**Risk:** callers learn the topology of richer roles and restrictions through errors alone.

## Proposed mitigation directions
1. **Capability lattice / partial order**
   - formalize role-capability relationships explicitly.

2. **Bounded downgrade + denial semantics**
   - minimize what policy structure is revealed through outcomes.

3. **Precedence-explicit policy evaluation**
   - blocked/risk/context restrictions should clearly outrank role grants.

4. **Context-bound capabilities**
   - capabilities should carry scope/context constraints.

5. **Minimal denial surface**
   - enough info for honest callers, not enough for policy mapping.

## Concrete next tasks
### Task 1 — Explicit capability lattice support
Acceptance criteria:
- adjacent-capability confusion fixture is resolved by deterministic lattice ordering,
- richer-role request evaluation is not ambiguous.

### Task 2 — Policy-precedence + context binding guard
Acceptance criteria:
- evaluation-order shadowing fixture fails,
- reused capability outside intended context is rejected.

### Task 3 — Bounded denial/downgrade semantics
Acceptance criteria:
- downgrade/deny outputs reveal limited policy structure,
- probing fixture cannot infer richer-role topology from errors alone.

## Non-overclaim caveat
This red-team pass does **not** show the capability-bound direction is wrong. It shows that without an explicit capability lattice, precedence rules, context binding, and bounded denial semantics, the system may evolve from **role-selection abuse** into **policy-binding abuse**.
