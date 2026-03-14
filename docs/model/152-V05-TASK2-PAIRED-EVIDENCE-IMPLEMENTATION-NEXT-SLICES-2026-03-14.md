# 152 — V05 Task 2 Paired-Evidence Implementation Next Slices (2026-03-14)

## Context
Task 2 is now the highest-value next slice: add a trustworthy intervention evidence bundle without contaminating scope or overclaiming from tiny samples.

## Task 1 (P0): JSON-first paired-evidence contract (intervention-target scope only)
Implement a dedicated aggregate block under `interventionTargetMetrics` with explicit denominator/scope fields:
- `pairedEvidenceScope`
- `pairedEvidenceDenominator`
- `unsettledShare`
- `firstMoverAShare`
- `sampleSize`
- `exploratoryOnly`

### Acceptance criteria
1. All paired-evidence fields are present in aggregate JSON with deterministic key names.
2. Denominator is explicit and intervention-scoped (no mixed-scope inference).
3. `exploratoryOnly` is machine-readable (not markdown-only).

## Task 2 (P0): Paired-evidence markdown parity + caveat hardening
Mirror the JSON paired-evidence block in aggregate markdown with the same semantics, including tiny-sample framing.

### Acceptance criteria
1. Aggregate markdown contains the paired-evidence section and mirrors JSON values exactly.
2. Tiny-sample caveat is visible in markdown and aligned with `exploratoryOnly` in JSON.
3. No markdown-only “extra truth” that diverges from JSON contract fields.

## Task 3 (P1): Comparison comparability gate (fingerprint + guardrail alignment)
Add comparison-level `comparable` status that fails closed when run-config fingerprints or single-variable guardrail assumptions diverge.

### Acceptance criteria
1. `comparison-latest.json` includes deterministic `comparable` + reason fields.
2. Mismatch in fingerprints/guardrails flips `comparable=false` with a machine-readable reason.
3. Clean strict baseline/intervention rerun preserves `comparable=true`.

## Priority order
1. Task 1
2. Task 2
3. Task 3

## Non-overclaim caveat
This roadmap improves evidence integrity and interpretation discipline only. It does not by itself prove broader intervention robustness or settlement reliability.
