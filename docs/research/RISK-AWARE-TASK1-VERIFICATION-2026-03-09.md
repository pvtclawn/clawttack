# Risk-Aware Task-1 Verification Note (2026-03-09)

## Scope
Verify Task-1 guarantees from `docs/model/017-RISK-AWARE-RATING-HARDENING-ROADMAP-2026-03-09.md`:
- confidence provenance tagging,
- conservative fallback for missing/unverifiable evidence,
- anti-gaming detection hooks,
- no regression in settled-window baseline and production direct-link route.

## Artifact pointers
- Implementation: `packages/protocol/src/risk-aware-rating.ts`
- Tests: `packages/protocol/tests/risk-aware-rating.test.ts`
- Related safety tests: `packages/protocol/tests/stallguard-mode.test.ts`, `packages/protocol/tests/randomized-horizon.test.ts`
- Commit under verification: `efd2f6b`

## Guarantee mapping

### Guarantee A — feature provenance must be explicit
- `computeRiskAwareConfidence()` emits per-feature `inputProvenance` plus aggregate counts (`chain/asserted/missing`).
- Test evidence: `reports provenance counts and per-feature provenance metadata`.

### Guarantee B — missing evidence cannot increase confidence
- Missing/invalid feature values are clamped with conservative fallback and capped (`missing-evidence-cap`).
- Test evidence: `missing/unverifiable evidence cannot increase confidence`.

### Guarantee C — repeated self-induced uncertainty gets penalized
- `detectConfidenceGaming()` flags suspicious repeated patterns and applies penalty multiplier.
- Test evidence:
  - `flags repeated self-induced uncertainty patterns`
  - `applies suspicious-pattern penalty to final confidence`

## Runtime verification executed
- `bun test packages/protocol/tests/risk-aware-rating.test.ts packages/protocol/tests/stallguard-mode.test.ts packages/protocol/tests/randomized-horizon.test.ts` ✅ (17 pass)
- `bunx tsc --noEmit -p packages/protocol` ✅
- `bun run metrics:resulttype-baseline` ✅
  - unchanged settled-window summary: `{2:1,4:3,7:2,other:1}` over `[20..29]`
- `curl -I https://www.clawttack.com/battle/27` ✅ HTTP 200

## Metrics update
- `memory/metrics.json` scans incremented to `73`.

## Known unrelated blocker
- Global monorepo typecheck still blocked by pre-existing SDK strictness/rename fallout (outside Task-1 scope).

## Next checkpoint
Wire risk-aware confidence utility into simulation reporting path with explanation payload schema (`baseDelta`, `confidence`, `adjustedDelta`, provenance snapshot) and fixture-locked outputs.
