# Verification-Claim Interaction Consistency Gate — Red-Team Report (2026-03-10)

## Scope
Review target:
- `docs/model/058-VERIFICATION-CLAIM-INTERACTION-CONSISTENCY-GATE-PLAN-2026-03-10.md`

Goal: identify how a workflow could pass module-level checks yet produce a misleading aggregate verdict due to interaction-level inconsistencies.

## Findings

### 1) Conflict-hiding aggregation precedence
**Vector:** aggregate reducer allows strong pass verdicts to overshadow prerequisite fail verdicts.

**Failure mode:** `interaction-consistency-pass` emitted despite hard prerequisite contradiction.

**Mitigation:** non-compensable prerequisite failures; deterministic reason `interaction-prereq-conflict`.

---

### 2) Selective module omission
**Vector:** omit one or more required module verdicts from bundle while retaining aggregate status output.

**Failure mode:** false completeness and understated uncertainty.

**Mitigation:** strict required-module set and completeness hash; fail with `interaction-evidence-incomplete`.

---

### 3) Reason-precedence manipulation
**Vector:** downgrade to softer reason when both soft and hard failure reasons are available.

**Failure mode:** severity laundering in audit trail.

**Mitigation:** deterministic worst-severity precedence lattice; fail with `interaction-reason-precedence-violation`.

---

### 4) Cross-version verdict stitching
**Vector:** merge module verdicts produced under different schema/config versions.

**Failure mode:** aggregate decision built from semantically incompatible modules.

**Mitigation:** version-lock invariant across bundle; fail with `interaction-version-mismatch`.

---

### 5) Alias-level semantic mismatch
**Vector:** exploit reason-alias drift to bypass strict conflict checks.

**Failure mode:** hidden contradictions due to taxonomy ambiguity.

**Mitigation:** canonical reason registry + unknown-alias hard-fail; reason `interaction-reason-alias-invalid`.

## Proposed hardening tasks
1. Add non-compensable prerequisite conflict checks + completeness hash enforcement.
2. Add deterministic reason-severity precedence lattice.
3. Add verdict-bundle version lock + canonical reason registry validation.

## Acceptance criteria for next lane
- Prerequisite-fail + aggregate-pass fixture fails deterministically.
- Missing-module fixture fails deterministically.
- Reason-downgrade fixture fails precedence validation.
- Cross-version bundle fixture fails with version mismatch.
- Unknown reason-alias fixture fails taxonomy validation.
