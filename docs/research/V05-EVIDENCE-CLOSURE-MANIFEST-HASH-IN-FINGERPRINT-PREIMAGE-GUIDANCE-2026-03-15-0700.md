# V05 evidence-closure manifest hash in fingerprint preimage — guidance (2026-03-15 07:00 UTC)

## Research question
Should the safety-envelope fingerprint preimage include an explicit evidence-closure manifest hash, and how can this stay deterministic?

## Signal summary
External provenance/audit patterns (canonical JSON + hash-chain style attestations) repeatedly converge on one rule: hash only canonicalized, completeness-scoped inputs, otherwise fingerprints can be stable but semantically incomplete.

## Decision
**Yes — include an explicit evidence-closure manifest hash in the fingerprint preimage.**

Without closure binding, a valid-looking fingerprint can still represent a pruned evidence tuple.

## Deterministic design proposal

### 1) Evidence-closure manifest (required)
- Add `evidenceClosureManifest` with:
  - `requiredEvidenceKeys` (sorted list)
  - `presentEvidenceKeys` (sorted list)
  - `missingEvidenceKeys` (sorted list)
  - `closureSatisfied` (bool)

### 2) Canonical manifest hash
- Serialize manifest with deterministic canonical JSON (sorted keys, normalized numeric/string forms, UTF-8).
- Compute `evidenceClosureManifestHash = sha256(canonical_manifest_json)`.

### 3) Fingerprint preimage upgrade
Include `evidenceClosureManifestHash` in `decisionDeterminismFingerprint` preimage together with existing:
- `ruleVersion`, `ruleHash`, `modeProfileHash`, evidence sources, aggregate allowance totals.

### 4) Fail-closed trigger
- If `closureSatisfied=false` OR reported manifest hash != computed hash:
  - emit `hard-invalid:safety-envelope-evidence-closure-incomplete`.

## Why this is the right next hardening direction
1. Blocks selective evidence omission while preserving deterministic reproducibility.
2. Gives auditable reason for non-credit state (missing/altered manifest).
3. Keeps scope small: manifest hashing can be added without full canonicalization overhaul in one patch.

## Suggested acceptance criteria (next implementation)
- Fixture A: complete manifest + matching hash => no closure trigger.
- Fixture B: missing required evidence key => closure trigger.
- Fixture C: complete manifest but tampered reported hash => closure trigger.
- Markdown/json both surface `closureSatisfied` and manifest-hash match status.

## Posting decision
No public post (internal guidance only; no new external evidence claim).
