# Reliability Status — V05 contamination-counter parity (2026-03-14 12:25 UTC)

## Scope
Synthesis after verification artifact:
- `docs/research/V05-CONTAMINATION-COUNTERS-PARITY-VERIFICATION-2026-03-14-1220.md`

## What is now reliable
1. **JSON-first contamination counters exist and are parity-stable** in aggregate JSON + Markdown:
   - `labelControlBlankCount`
   - `labelInterventionBlankCount`
   - `labelCollapseCount`
   - `maxTurnsMismatchCount`
2. **Strict diagnostics remain deterministic** for covered classes:
   - clean strict run: zero violations / zero counters
   - label-collapse injection: one violation with aligned counter
   - self-test harness classes still deterministic (`label-collapse=1`, `max-turns-mismatch=1`, `combined=2`).
3. **Output-boundary strict semantics are preserved** (diagnostics written before strict failure).

## What remains intentionally narrow
- Current strict/injection coverage is still limited to implemented classes.
- No claim yet of full contamination taxonomy coverage.
- No on-chain action needed for this lane (local reliability synthesis only).

## Decision framing for next slice
Highest-value next move is **Lane E → learning-guided scoping** for either:
- extending strict classes/counters (if immediate hardening value remains high), or
- pivoting to the intervention-labeled variation batch path (if current strict reliability is sufficient for now).

Given current artifacts are deterministic and clean for covered classes, the pragmatic default is:
1. write one compact decision note comparing those two paths,
2. then pick one next build slice (not both).
