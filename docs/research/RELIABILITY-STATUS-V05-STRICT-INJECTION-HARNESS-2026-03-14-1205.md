# Reliability Status — V05 Strict-Injection Harness (2026-03-14 12:05 UTC)

## What was synthesized
Reviewed the latest strict-injection verification artifact:
- `docs/research/V05-STRICT-INJECTION-HARNESS-VERIFICATION-2026-03-14-1159.md`

## Current reliability status
1. **Strict-injection Task 1 is now evidence-backed.**
   - `--self-test-strict-injections` returns `ok` for all currently covered classes.
2. **Deterministic violation sets are confirmed for covered classes.**
   - `label-collapse` => 1 strict violation
   - `max-turns-mismatch` => 1 strict violation
   - `combined` => 2 strict violations (deterministic ordering preserved)
3. **Output-boundary strict semantics remain intact.**
   - diagnostics are persisted before strict failure behavior.
4. **Clean strict path remains healthy after harness execution.**
   - strict labeled refresh still passes with zero strict violations.

## Strongest honest claim (non-overclaim)
The strict-injection harness is reliable for the three explicitly covered classes and deterministic expected-vs-actual matching is proven.

## Remaining highest-value hardening
- Extend beyond current three classes with broader contamination coverage.
- Add orthogonal contamination counters tied to strict classes.
- Keep canonical ordering guarantees explicit as classes expand.

## On-chain classification
- **Verified no action needed.**
- This lane is local reliability synthesis only; no tx/attestation would strengthen this claim.
