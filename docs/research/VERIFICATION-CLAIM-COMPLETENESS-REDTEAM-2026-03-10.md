# Verification Claim Completeness Gate — Red-Team Report (2026-03-10)

## Scope
Red-team review of:
- `docs/model/048-VERIFICATION-CLAIM-COMPLETENESS-GATE-PLAN-2026-03-10.md`

Goal: identify how an adversary (or rushed operator) could satisfy the proposed deterministic gate while still shipping misleading reliability claims.

## Findings

### 1) Caveat-token gaming
**Vector:** satisfy completeness by inserting token caveats without narrowing claim meaning.

**Failure mode:** `report-pass` despite materially incomplete risk framing.

**Mitigation:** semantic caveat templates with required slots:
- scope bound,
- unresolved blocker,
- non-proven integration/runtime statement.

---

### 2) Evidence laundering
**Vector:** attach real but non-causal artifacts to stronger claims.

**Failure mode:** checker sees "evidence exists" but not claim-evidence relevance.

**Mitigation:** deterministic relevance map:
- `simulation-verified` allows fixture/typecheck artifacts only;
- `integration-verified` requires integration-path artifact;
- `runtime-verified` requires live runtime signal.
Reject mismatches with `report-evidence-scope-mismatch`.

---

### 3) Wording-level overclaim implication
**Vector:** avoid explicit prohibited phrases while implying resolution/stability.

**Failure mode:** lexical bypass with pragmatic overclaim.

**Mitigation:** implication-risk lexicon + class-aware phrase policy.
Example: block "resolved" for simulation-only claims unless runtime proof present.

---

### 4) Caveat burying
**Vector:** include caveat outside the attention path (footer/appendix).

**Failure mode:** formal completeness, practical incompleteness.

**Mitigation:** proximity constraint: required caveat must appear in same section/paragraph window as primary claim sentence.

---

### 5) Claim-class text mismatch
**Vector:** metadata class says simulation, headline reads production certainty.

**Failure mode:** class-value and rendered text diverge.

**Mitigation:** class-text consistency rule with deterministic reason `claim-class-text-mismatch`.

## Proposed hardening tasks
1. Add semantic caveat schema + required-slot validator.
2. Add claim-evidence scope relevance matrix + mismatch reason codes.
3. Add class-aware implication lexicon + proximity constraint for caveats.

## Acceptance criteria for next lane
- At least one fixture where caveat tokens exist but semantic slots are missing -> must fail.
- At least one fixture where evidence exists but scope relevance mismatches -> must fail.
- At least one fixture where claim class and headline implication diverge -> must fail.
