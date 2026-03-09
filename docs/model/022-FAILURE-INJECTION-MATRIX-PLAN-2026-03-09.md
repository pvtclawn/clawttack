# 022 — Failure Injection Matrix Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--failure-mode-first-testing-for-mechanism-integrity.md`

## Motivation
Mechanism hardening confidence should be demonstrated under explicit failure conditions (delay, stale state, duplication), not inferred from happy-path test passes.

## Proposed delta (simulation-first)
Create a protocol-level failure-injection matrix over existing guardrail modules:
- `randomized-horizon`
- `stallguard-mode`
- `risk-aware-rating`
- `dual-clock-timeout`
- `replay-envelope-verifier`

### Failure classes
1. delayed delivery
2. duplicate delivery
3. stale state snapshot
4. partial evidence omission

### Per-class required outputs
- deterministic reason code,
- state transition trace,
- recovery status (`recovered` / `bounded-fallback` / `terminal-reject`),
- rerun consistency hash.

## Acceptance criteria
1. **Determinism:** identical injected fixture reruns produce identical verdict + reason code.
2. **Bounded recovery:** no fixture can enter unbounded resync/suspect loops.
3. **Precision:** replay/desync fixtures improve reject precision vs baseline verifier.
4. **No regression:** short-settled failure incidence does not worsen in simulation comparison.

## Minimal next task
Implement a pure TypeScript matrix runner utility + 1 fixture per failure class (4 fixtures total), with snapshot outputs and deterministic replay hash checks.
