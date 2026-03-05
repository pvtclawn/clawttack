# 011 — Model vNext Spec (Draft)

Status: Draft (falsifiable statement set)
Date: 2026-03-05

## 0) Scope
Formalize acceptance logic for mechanism updates around failure classes `2/4/7` using evidence-first, on-chain/artifact-observable criteria.

---

## 1) Assumption block

### A1 — Comparability-gated inference (anti-circular)
**Condition:** candidate vs baseline window comparison is requested.

**Observables (independent):**
1. Artifact metadata fields exist and are complete (`attacker_model`, `evidence_quality`, `assumption_breaks`).
2. Comparator output status/reason codes from `scripts/compare-resulttype-artifacts.ts`.

**Accept criterion:**
- `status == comparable` AND `reasonCodes == []`.

**Reject criterion:**
- `status == non_comparable` OR any reason code present.

**Implication:**
- On reject, improvement headlines are invalid.

### A2 — Evidence-quality claim validity
**Condition:** submission/report claims measured outcome improvements.

**Observables:**
1. `evidence_quality.status` in artifacts.
2. `headlineAllowed` field from comparator output.

**Accept criterion:**
- `evidence_quality.status == success` AND `headlineAllowed == true`.

**Reject criterion:**
- `degraded_success` or `insufficient_evidence` or `headlineAllowed == false`.

**Implication:**
- Reject blocks strong outcome claims; only qualified infrastructure claims allowed.

### A3 — Dual-gate mechanism acceptance (reliability + efficiency)
**Condition:** mechanism patch is proposed as "accepted".

**Observables:**
1. Reliability observable: comparability status and reason-code cleanliness.
2. Efficiency observable: executable single-command validation path (`./scripts/pre-submit-verify.sh`) and pass result.

**Accept criterion:**
- Reliability gate passes (A1) AND efficiency gate pass is reproducible.

**Reject criterion:**
- Either gate fails.

**Implication:**
- Single-metric pass cannot accept a patch.

---

## 2) Temporal stability rule

### S1 — Repeated-run stability
**Condition:** accepting a model/mechanism claim for current config window.

**Observable:**
- `N` consecutive successful runs of pre-submit validation and comparator checks.

**Current threshold (draft):**
- `N >= 2` consecutive runs.

**Accept criterion:**
- At least 2 consecutive passes with no new reason codes.

**Reject criterion:**
- Any run fails or emits non-empty reason codes.

---

## 3) Threshold bands (draft)

Because current window shows zero-delta stability behavior, thresholds are defined as gating bands:

1. **Comparability band:**
   - Required: `comparable`, reasonCodes empty.
2. **Evidence-quality band:**
   - Required: status `success`.
3. **Caveat band:**
   - Required for strong headline: caveat count within allowed bound (current policy default: `0`).

If any band fails, patch/report acceptance downgrades from strong claim to qualified/no-claim.

---

## 4) Falsification tests

1. Inject attacker-model mismatch artifact -> expected `non_comparable` + reason code.
2. Inject placeholder metadata token -> expected `METADATA_PLACEHOLDER` failure.
3. Force caveat overflow above policy bound -> expected `headlineAllowed == false`.

If expected outcomes are not observed, this model draft is invalid.

---

## 5) Current limitations

- Threshold values are still policy-level, not yet learned from large non-zero delta windows.
- Efficiency metric remains coarse (command-level pass path) and should be refined with explicit cost/latency bands in next revision.
