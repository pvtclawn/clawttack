# Context-Bound Capability Gate Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/126-CONTEXT-BOUND-CAPABILITY-GATE-PLAN-2026-03-11.md`

## Why this might fail
Context binding is stronger than a free-floating capability grant, but it creates a new optimization target: the **shape of the scope itself**. Attackers can probe how closely a request must match the bound context, whether nearby scopes downgrade or deny, and which context encodings are treated as equivalent.

## Weaknesses identified
### 1. Context confusion
Context taxonomies can be too coarse or semantically blurry.

**Risk:** a capability appears valid because the scope model is fuzzy, not because the use is genuinely allowed.

### 2. Replay across nearby scopes
Capabilities may be reused on adjacent contexts that look sufficiently similar.

**Risk:** context binding becomes soft and replayable across neighboring cases/scopes.

### 3. Downgrade abuse
Mismatched context that triggers downgrade instead of denial can leak the adjacency structure of the policy.

**Risk:** callers learn which nearby scopes still produce useful fallback access.

### 4. Context-normalization bugs
Identifier aliases, formatting differences, or namespace quirks can distort policy evaluation.

**Risk:** serialization bugs become authorization bugs.

### 5. Scope-lifetime drift
A scope can change faster than the capability bound to it.

**Risk:** stale capabilities remain usable after the intended context is no longer the same in practice.

## Proposed mitigation directions
1. **Typed scope ontology**
   - treat scope as structured policy data, not loose strings.

2. **Strict replay boundary**
   - only explicit subsumption rules should allow broader/narrower scope reuse.

3. **Bounded downgrade semantics**
   - minimize what adjacency information is leaked through downgrade behavior.

4. **Canonical context normalization**
   - normalize all identifiers and scope encodings through one deterministic path.

5. **Scope freshness controls**
   - bind capabilities to a validity window or version when relevant.

## Concrete next tasks
### Task 1 — Typed scope + canonical normalization support
Acceptance criteria:
- context-serialization mismatch fixture resolves deterministically,
- adjacent-scope confusion fixture fails without explicit subsumption rule.

### Task 2 — Replay-boundary guard
Acceptance criteria:
- nearby-scope replay fixture is rejected,
- explicit subsumption rule fixture is handled deterministically.

### Task 3 — Bounded downgrade + freshness guard
Acceptance criteria:
- downgrade outputs leak limited adjacency info,
- stale capability reuse after scope change is rejected.

## Non-overclaim caveat
This red-team pass does **not** show the context-bound capability direction is wrong. It shows that without typed scope semantics, strict replay boundaries, canonical normalization, bounded downgrade behavior, and freshness controls, the system may evolve from **free-floating grants** into **sloppy scope grants**.
