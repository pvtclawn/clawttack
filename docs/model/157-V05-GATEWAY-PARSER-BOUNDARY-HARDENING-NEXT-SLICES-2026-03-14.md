# 157 — v05 gateway parser-boundary hardening next slices (2026-03-14)

## Context
Latest live confirmation attempt (battle #42) proved create/accept liveness with RPC fallback, but failed in `v05-battle-loop.ts` at gateway output parsing: non-JSON preamble text preceded expected JSON and caused `JSON.parse(raw)` to throw.

## Task 1 (P0) — Noise-tolerant gateway JSON extraction at parser boundary
Implement parser-boundary extraction in `packages/sdk/scripts/v05-battle-loop.ts`:
- Treat gateway stdout as an envelope, not trusted pure JSON.
- Extract the first valid top-level JSON object from mixed output (allow preamble/noise lines).
- Add stage-labeled logs: `gateway-parse.raw`, `gateway-parse.extract-ok|extract-fail`, `gateway-parse.schema-ok|schema-fail`.

### Acceptance criteria
1. A fixture/stdout sample with warning preamble + valid JSON payload parses successfully.
2. A malformed/no-JSON sample fails closed with explicit parser-boundary error class and bounded preview.
3. No silent fallback to ambiguous/default payloads.

## Task 2 (P0) — Deterministic schema-key validation after extraction
After extraction, validate required payload keys before use.
- If required keys are missing, classify as parser/schema boundary failure (not generic runtime).
- Preserve deterministic, machine-readable failure detail for summarizer classification.

### Acceptance criteria
1. Missing-key payloads fail with explicit key list in failure detail.
2. Valid payloads proceed unchanged to turn-construction/submit stages.
3. Existing strict guardrails remain green on clean path.

## Task 3 (P1 gate) — Strict post-patch live confirmation gate
Run one strict live confirmation sample after Task 1+2 patch.
- Keep scale-up blocked unless parser-boundary contamination is absent in the sampled run.

### Acceptance criteria
1. One-battle strict confirmation completes without JSON parse contamination error.
2. Artifact includes stage evidence showing parser extraction + schema validation succeeded.
3. If parser-boundary error recurs, scale-up remains blocked and failure is explicitly classified.

## Notes
- This roadmap narrows parser-boundary reliability only.
- It does not claim broad runtime robustness, settlement reliability, or high-volume readiness.
