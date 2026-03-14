# Reliability Status — v05 guardrail contract parity (2026-03-14 11:04 UTC)

## Scope
Synthesis lane after parity verification (`V05-GUARDRAIL-CONTRACT-PARITY-VERIFICATION-2026-03-14-1059.md`).

## Current reliability claim (narrow, evidence-backed)
1. Aggregate guardrail contract is now machine-readable in JSON and mirrored in Markdown:
   - `labelHygieneOk`
   - `maxTurnsComparable`
   - `warnings[]`
2. Current labeled refresh confirms parity state:
   - `labelHygieneOk=true`
   - `maxTurnsComparable=true`
   - `warnings=[]`
3. Intervention-target turn-budget denominator remains explicit and intervention-scoped (`interventionTargetMetrics.battleCount`).

## What this does NOT prove
- It does not prove strict fail-fast behavior for bad labels/mixed populations.
- It does not prove contamination counters or runtime enforcement beyond reporting.
- It does not increase on-chain confidence directly (local summary/review reliability only).

## Remaining Task 2 hardening (scoped)
1. Add contamination counters for unlabeled/normalized-colliding label populations.
2. Add optional strict mode to fail/exit when guardrail warnings are non-empty.
3. Preserve JSON-first warning contract and keep Markdown parity (human + machine review consistency).

## Next suggested lane action
Lane E: capture a compact implementation note for strict-mode + contamination-counter semantics, then decide whether to implement strict guardrails now or defer until after an intervention-labeled batch run.
