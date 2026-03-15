# V05 failure-class timeout subtype mapping guidance — 2026-03-15 06:00 UTC

## Research question
Should failure-class derivation add stricter timeout subtype mapping to reduce broad `runtime/generic` buckets while staying deterministic?

## Signal summary
External reliability material (InfoQ/retry-timeout literature) consistently distinguishes timeout families (connect/read/response/retry-budget), because collapsing them hides remediation paths and increases misclassification drift.

## Decision
**Yes — add deterministic timeout subtypes under runtime failure taxonomy.**

Current behavior routes many timeout-shaped errors to `runtime/generic`, which weakens both:
1. trigger precision for claim-limiting reasons,
2. future policy controls for allowance logic tied to timeout semantics.

## Proposed deterministic subtype mapping (string-token based)
When `error_line` contains timeout markers, classify in this order:
1. `runtime/timeout-connect`
   - tokens: `connect timeout`, `connection timed out`, `dial tcp`, `tls handshake timeout`
2. `runtime/timeout-response`
   - tokens: `timed out waiting for gateway response`, `response timeout`, `await response timeout`
3. `runtime/timeout-retry-budget`
   - tokens: `retry budget exhausted`, `max retries exceeded`, `backoff exhausted`
4. fallback: `runtime/timeout-generic`
   - tokens: `timed out`, `timeout`

If no timeout tokens, keep existing non-timeout mappings unchanged.

## Why this is worth doing now
- Improves deterministic diagnostics without widening classifier ambiguity.
- Gives cleaner hooks for later timing-allowance policies (e.g., only certain timeout subtypes can qualify for bounded allowance).
- Reduces `runtime/generic` overuse while preserving fail-closed posture.

## Next-slice acceptance criteria
- Fixture A (`timed out waiting for gateway response`) => `runtime/timeout-response`
- Fixture B (`connect timeout` / `dial tcp`) => `runtime/timeout-connect`
- Fixture C (`max retries exceeded`) => `runtime/timeout-retry-budget`
- Fixture D (`operation timed out`) => `runtime/timeout-generic`
- Existing non-timeout classifiers remain stable (no regressions).

## Posting decision
No external post (internal taxonomy hardening guidance only).
