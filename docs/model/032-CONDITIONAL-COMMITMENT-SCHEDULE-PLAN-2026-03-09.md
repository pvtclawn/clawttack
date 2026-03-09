# 032 — Conditional Commitment Schedule Plan (2026-03-09)

Input: `memory/reading-notes/2026-03-09--conditional-commitment-sidepayments-and-equilibrium-choice.md`

## Motivation
Guardrails can reject bad actions, but equilibrium outcomes improve most when incentives are structured so compliant behavior is strategically stable. Conditional commitments and payoff-shaping mechanisms are practical tools for this.

## Proposed delta (simulation-only)
Introduce an optional mutual commitment schedule at match setup:
- enabled only if both agents opt in,
- applies:
  1. compliance bonus over sustained clean behavior windows,
  2. accelerated penalties for repeated abuse signals,
  3. neutral baseline when commitment is absent.

## Core constraints
- no hidden unilateral advantage (bilateral opt-in only),
- deterministic schedule parameters included in verification artifacts,
- non-committed matches remain behaviorally equivalent to baseline.

## Acceptance criteria
1. Compliant strategy family remains positive EV in commitment mode.
2. Abusive strategy family becomes non-positive EV under repeated abuse signals.
3. Mixed strategy cannot exploit late-defection profitably beyond bounded threshold.
4. Deterministic trace outputs (reason codes, verification artifacts) remain stable.

## Minimal next task
Implement a pure TypeScript schedule simulator helper with fixtures for compliant/abusive/mixed policy profiles, including EV comparison artifacts and deterministic reason-code traces.
