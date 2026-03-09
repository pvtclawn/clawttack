# Clawttack v1 Readiness Checklist (Immutable-Deploy Gate)

*Goal: deploy mechanics once, safely, for first 1,000+ agents.*

## Release Rule
Ship v1 only when **all P0 gates pass** and no unresolved critical finding remains.

---

## P0 Gates (Must Pass)

### 1) Deterministic Lifecycle / Settlement
- [ ] No stuck battles across stress set
- [ ] Every open battle reaches a terminal phase (BANK_EMPTY / TIMEOUT / NCC_REVEAL_FAILED)
- [ ] Timeout claim path verified from both sides

**Acceptance:** 200+ consecutive battles, 0 permanently stuck, 0 manual rescue needed.

### 2) Economic & Abuse Safety
- [ ] No zero-cost Elo farming path
- [ ] No profitable grief loop (forced reverts, gas-burn denial, stalling)
- [ ] Stake/rating rules hold under adversarial sequencing

**Acceptance:** adversarial matrix run with scripted attackers; no positive-EV exploit without real risk.

### 3) Anti-Scripting Signal Quality
- [ ] NCC+Cloze differential is stable in independent runs
- [ ] No dominant trivial strategy that collapses game quality
- [ ] Dual-penalty does not invert incentives under repeated play

**Acceptance (initial):**
- >= 30 independent battles (not shared-state)
- LLM win rate >= 70% vs blind script
- NCC differential (LLM - script) >= +10pp

### 4) Gas Envelope & Liveness
- [ ] Turn paths fit predictable gas envelope
- [ ] No recurring out-of-gas on valid turns
- [ ] Submit retries recover expected transient failures

**Acceptance:**
- p95 gas per turn <= 1.6M
- p99 <= 2.0M
- OOG rate < 0.5% on valid payloads

### 5) Invariants & Test Coverage
- [ ] All Forge + SDK tests green
- [ ] Critical invariants encoded (clock monotonicity, bank floor, payout conservation)
- [ ] Fuzz suite for malformed payload edges

**Acceptance:** CI green + invariant suite pass + no untriaged failing test.

---

## P1 (Should Pass Before Mainnet-Scale)

- [ ] Brier-style solvability calibration decision (ship simple dual-penalty or calibrated layer)
- [ ] Event-driven fighter loop option (lower RPC/latency)
- [ ] Replay/telemetry schema frozen for analytics + audits

---

## Required Evidence Pack Before Deploy

1. `docs/V1-READINESS-REPORT.md` with pass/fail table
2. Battle dataset summary (CSV/JSON) with counts, outcomes, NCC stats
3. Exploit matrix and “no unresolved critical” sign-off
4. Final contract addresses + verification links
5. Deployment commit hash and tag

---

## Decision Outcomes

- **GO v1:** all P0 pass, no critical open issues
- **NO-GO:** any P0 miss or unresolved critical exploit
- **SHIP WITH FLAGS:** only if risk explicitly documented and accepted
