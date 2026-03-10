# 055 — Verification-Claim Safety+Liveness Hardening Roadmap (2026-03-10)

## Context
Derived from red-team findings in:
- `docs/research/VERIFICATION-CLAIM-SAFETY-LIVENESS-REDTEAM-2026-03-10.md`

Goal: prevent claim workflows from passing correctness gates through false terminal signals, timer-boundary gaming, or partial-trace omission.

## Task 1 — Terminal Admissibility + Trace Continuity Gate
Require terminal states to prove prerequisite phase completion and full trace continuity.

### Scope
- Terminal status valid only if prerequisite phases are present and verified.
- Enforce continuity from `ingest` to terminal with no missing links.
- Reject partial-tail submissions.

### Acceptance criteria
1. Synthetic terminal-without-prereqs fixture fails with `terminal-prereq-missing`.
2. Partial-trace fixture fails with `trace-continuity-missing`.
3. Complete phase-consistent trace passes this gate.

---

## Task 2 — Monotonic Timer + Anti-Boundary-Gaming Controls
Harden liveness evaluation against deadline-edge oscillation abuse.

### Scope
- Enforce monotonic timer source for liveness decisions.
- Add anti-oscillation hysteresis around timeout boundaries.
- Reject boundary-jitter exploitation attempts.

### Acceptance criteria
1. Boundary gaming fixture fails with `timer-boundary-gaming-detected`.
2. Non-monotonic timer sequence fails deterministically.
3. Stable monotonic timer sequence near boundary (without oscillation abuse) passes.

---

## Task 3 — Critical Safety Taxonomy Integrity + Terminal Semantic Validity
Prevent safety-reason laundering and semantically invalid terminal convergence.

### Scope
- Critical safety reasons are immutable and non-downgradable.
- Terminal state must satisfy semantic validity checks, not just convergence.
- Fast convergence to invalid terminal state must hard-fail.

### Acceptance criteria
1. Critical-reason remap attempt fails with `safety-reason-integrity-fail`.
2. Converged-but-invalid terminal fixture fails with `terminal-state-invalid`.
3. Valid terminal with clean safety lineage passes.

## Next Task (single)
Lane B: implement Task 1 in simulation/tooling scope (terminal admissibility + trace continuity evaluator + fixtures), no publish-path wiring in same change.
