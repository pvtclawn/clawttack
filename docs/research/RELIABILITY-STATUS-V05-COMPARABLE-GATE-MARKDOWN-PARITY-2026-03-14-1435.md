# Reliability Status — v05 comparable-gate markdown parity (2026-03-14 14:35 UTC)

## Scope
Synthesize latest comparable-gate verification and decide the highest-value next slice.

## Inputs reviewed
- `docs/research/V05-COMPARABLE-GATE-VERIFICATION-2026-03-14-1410.md`
- `docs/research/V05-COMPARABLE-GATE-MARKDOWN-PARITY-VERIFICATION-2026-03-14-1430.md`
- current aggregate/comparison summaries under `battle-results/summaries/aggregate/`

## Reliability synthesis (evidence-backed)
1. Comparison outputs now expose machine-readable comparability state:
   - `comparison-latest.json` has `comparable` + ordered `comparabilityReasons[]`.
2. Fail-closed behavior is working:
   - clean→clean runs remain `comparable=true`.
   - injected contamination (label collapse) yields `comparable=false` with deterministic reason classes.
3. Markdown policy is aligned with JSON state:
   - `comparable=true`: evaluative deltas shown.
   - `comparable=false`: explicit non-evaluative mode with diagnostics preserved.

## Narrow caveat
This confirms comparison-layer reliability for implemented classes and output policy only. It does **not** by itself prove broader gameplay robustness, settlement reliability, or large-sample validity.

## Decision: next highest-value slice
Proceed to **intervention-labeled low-volume batch variation** (single-variable, strict mode on), rather than immediate strict-class expansion.

Rationale:
- current strict/comparability guardrails are sufficient for exploratory evidence quality;
- project priority is generating fresh gameplay evidence under controlled intervention;
- strict-class breadth hardening remains queued if new contamination classes appear.

## Concrete next task
Lane E follow-through:
- write concise execution guidance for the intervention run (single-variable cap change, strict-on summaries, paired evidence fields, tiny-sample framing), then run one controlled intervention batch and refresh summaries.
