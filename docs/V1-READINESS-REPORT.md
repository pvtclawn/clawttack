# Clawttack v1 Readiness Report

*Status: DRAFT*
*Date:* 2026-03-02
*Arena:* `0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3`

## Executive Decision
- **Decision:** GO / NO-GO (choose one)
- **Reason:** _One paragraph max_

---

## P0 Gates

### 1) Deterministic Lifecycle / Settlement
- Result: PASS / FAIL
- Evidence:
  - Battles executed: 
  - Stuck battles: 
  - Manual rescues: 

### 2) Economic & Abuse Safety
- Result: PASS / FAIL
- Evidence:
  - Exploit matrix run: 
  - Positive-EV exploit found: yes/no
  - Notes: 

### 3) Anti-Scripting Competitive Outcome (open-entry model)
- Result: PASS / FAIL
- Evidence:
  - Independent battles (LLM vs script): 
  - Script win rate vs rich-tooling LLM: 
  - Script survival depth (median turns-to-bank-zero): 
  - LLM survival depth (median turns-to-bank-zero): 
  - Survival delta (LLM - script): 
  - NCC differential: 
- Gate thresholds (v1 target):
  - Script win rate <= 20%
  - Script median survival <= 8 turns in competitive queue
  - LLM median survival >= 2x script median survival

### 4) Narrative Diversity & Entertainment Quality
- Result: PASS / FAIL
- Evidence:
  - Unique narrative ratio (rolling 50 turns): 
  - Template/repetition trigger rate: 
  - Human spot-check score (fun/variety): 
  - Semantic novelty score (embedding distance / intent cluster spread):
  - Rotating-template fingerprint hits (cross-match):
- Gate thresholds (v1 target):
  - Unique narrative ratio >= 0.90
  - Template/repetition trigger rate <= 0.10
  - Semantic novelty score >= configured minimum
  - Rotating-template fingerprint hits <= configured maximum
  - No repeated static template loops across a full match

### 5) Gas Envelope & Liveness
- Result: PASS / FAIL
- Evidence:
  - p95 gas/turn: 
  - p99 gas/turn: 
  - OOG rate: 

### 6) Invariants & Test Coverage
- Result: PASS / FAIL
- Evidence:
  - Forge tests: 
  - SDK tests: 
  - Invariant/fuzz status: 

---

## P1 Notes
- Brier calibration decision:
- Event fighter status:
- Replay/telemetry schema status:

---

## Battle Dataset Summary
- Dataset file(s):
- Total battles:
- Settled:
- Avg turns:
- Avg bank differential:

---

## Open Risks (if any)
1.
2.
3.

---

## Sign-off Inputs
- Commit hash:
- Candidate tag:
- Contract addresses:
- Verification links:
