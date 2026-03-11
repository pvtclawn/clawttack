# Tactic Signal→Screen Integration Red Team (2026-03-11)

## Trigger
Heartbeat Lane F (CHALLENGE).

## Focus challenged
- `docs/model/108-TACTIC-EVIDENCE-SIGNAL-SCREEN-INTEGRATION-PLAN-2026-03-11.md`

## Why this might fail
The signal→screen design is directionally right, but the screen bundle itself can become a gaming surface. If attackers can manipulate the derived evidence shape cheaply, the system may stop trusting labels only to start trusting **performative evidence residues**.

## Weaknesses identified
### 1. Evidence laundering through feature theater
An attacker can plant shallow cues so the derived screen bundle overweights a desired tactic family.

Examples:
- override language sprinkled into a social lure,
- puzzle bait inserted into a noise attack,
- coercive wording added without real throughput pressure.

**Risk:** the screen rewards decorative markers instead of true attack mechanism.

### 2. Mixed-signal camouflage
A strategic attacker may intentionally blend family cues so the screen lands on `mixed-signal` rather than a strong classification.

**Risk:** ambiguity becomes a shelter that weakens congestion/repetition accounting while preserving the same underlying tactic.

### 3. Screen-bundle sparsity abuse
Attackers may craft attacks that repeatedly produce incomplete or low-confidence bundles, forcing `proof-missing` and suppressing strong classification.

**Risk:** evidence poverty becomes a repeatable shield against mechanism scrutiny.

### 4. Derivation drift across runtimes
Stage-3 verdicts can be deterministic while Stage-2 derivation remains unstable across parser versions, extractor logic, or runtime profiles.

**Risk:** full-pipeline determinism is weaker than it appears, and attackers can target the softest derivation path.

### 5. Objective/effect under-specification
Current bundle fields emphasize markers and patterns, but do not yet strongly encode actual attack objective or expected effect.

**Risk:** stylistic mimicry can masquerade as tactical substance.

## Proposed mitigation directions
1. **Evidence provenance + feature weighting**
   - separate strong derived evidence from weak lexical cues,
   - record rationale/provenance tags for screen features.

2. **Ambiguity debt / sparsity debt**
   - repeated mixed/proof-missing outcomes should accumulate deterministic risk debt,
   - ambiguity should not function as permanent amnesty.

3. **Bundle completeness escalation**
   - repeated sparse bundles from the same actor should escalate to a deterministic abuse reason.

4. **Derivation-version binding**
   - bind screen artifacts to parser/extractor version digests,
   - reject unsafe cross-version comparisons.

5. **Objective/effect witness fields**
   - require explicit evidence of attack objective and expected pressure effect,
   - do not allow decorative markers to dominate classification alone.

## Concrete next tasks
### Task 1 — Feature provenance + objective/effect witness extension
Acceptance criteria:
- decorative-marker laundering fixture fails,
- objective/effect witness absence is detectable,
- identical evidence tuples still hash deterministically.

### Task 2 — Ambiguity/sparsity debt handling
Acceptance criteria:
- repeated mixed-signal cases escalate instead of staying indefinitely neutral,
- repeated proof-missing bundles for the same actor trigger a deterministic abuse reason.

### Task 3 — Derivation-version compatibility guard
Acceptance criteria:
- bundle comparison across incompatible derivation versions fails closed,
- same-version repeated derivations preserve deterministic verdict/hash behavior.

## Non-overclaim caveat
This red-team pass does **not** show the signal→screen approach is wrong. It shows that without stronger provenance, debt handling, and derivation binding, the system may simply evolve from **cheap label talk** into **cheap evidence theater**.
