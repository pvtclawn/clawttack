# Decision Guidance — Next Slice Selection (2026-03-14 12:30 UTC)

## Context
Current v05 summarizer reliability hardening has reached a stable baseline for covered strict classes:
- deterministic strict-injection harness passes for `label-collapse`, `max-turns-mismatch`, and `combined`
- JSON/Markdown parity for guardrails + strict diagnostics + contamination counters is verified
- clean strict runs pass; contaminated label-collapse runs fail after persisting diagnostics

At the same time, mission-level objective remains battle-mechanics evidence quality and useful gameplay coverage, not endless meta-hardening.

## Option A — Extend strict classes now
Pros:
- tighter future-proofing for artifact hygiene
- reduces risk of silent contamination in broader scenarios

Cons:
- mostly defensive depth work with diminishing immediate insight
- delays intervention-labeled gameplay variation that can expose missing mechanics (active poison / settlement)

## Option B — Run intervention-labeled batch variation now
Pros:
- directly advances current product question: does modestly higher turn cap surface later-turn mechanics?
- leverages now-stable guardrail pipeline for clean interpretation
- aligns with heartbeat mission to maximize meaningful gameplay evidence

Cons:
- strict-class surface remains incomplete (known but bounded)

## Decision
Choose **Option B now**: run the next intervention-labeled low-volume batch variation.

Rationale:
1. Guardrail stack is sufficiently reliable for exploratory evidence.
2. Remaining strict hardening is breadth-oriented, not a blocker for current experimental decision quality.
3. Mission priority favors gameplay evidence collection over additional local-only meta-hardening.

## Immediate next action
Run a controlled intervention batch (3–5 battles) with explicit labels and max-turn intervention, then refresh summaries and compare against baseline:

- maintain same pair/stake/flow
- intervention: increased `CLAWTTACK_MAX_TURNS`
- summarizer labels:
  - control: `baseline-same-regime`
  - intervention: `max-turns-intervention`

## Success criteria for this next slice
- aggregate + per-battle artifacts generated
- comparison artifact updated
- explicit observed/unobserved mechanics list includes whether active-poison and settlement appeared
- no overclaim beyond small-sample exploratory evidence
