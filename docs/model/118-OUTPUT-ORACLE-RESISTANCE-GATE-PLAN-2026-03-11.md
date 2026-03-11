# 118 — Output Oracle-Resistance Gate Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/008_serious_cryptography.pdf`
- side-channel discussion on error messages / return values / branches
- padding-oracle description

## Core insight
A system can leak critical information not only through its core algorithm, but through the **behavior of the surrounding system**: error messages, return values, and branching behavior.

For Clawttack, the verification stack is now producing increasingly structured output modes. That means the output layer itself can become a feedback channel about:
- route selection,
- budget exhaustion,
- contradiction thresholds,
- candidate-set geometry,
- and low-trust vs blocked semantics.

## Problem this addresses
Current output-mode work is trying to make degraded and blocked responses honest and distinguishable. That is necessary, but it introduces a new risk:
- outputs may become an **oracle** that helps attackers tune ambiguity, budget-farming, or contradiction-laundering strategies.

In other words, the system may correctly classify risk while still leaking too much about *how* it classified risk.

## Proposed runtime integration delta
Add a deterministic **output-oracle-resistance gate** after output-mode selection.

### Inputs
The gate should consume:
- selected output mode
- hostile/non-hostile risk class
- candidate/explanation detail budget
- route decision trace
- degraded/blocked trust semantics

### Deterministic actions
Proposed outcomes:
- `tactic-output-public-safe`
- `tactic-output-redacted`
- `tactic-output-blocked`

### Policy shape
- primary/backup outputs can expose normal detail within a configured budget,
- degraded outputs must coarsen candidate/explanation detail,
- hostile/blocked outputs should expose only minimal safe metadata,
- route and verifier-state details should be normalized enough to avoid becoming a tuning oracle.

### Redaction targets
Potentially sensitive details include:
- fine-grained candidate rankings,
- exact contradiction thresholds,
- precise budget counters,
- richly differentiated blocked/degraded subreasons,
- excessively specific route traces.

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` that:
- accepts a compact output artifact + risk context,
- applies deterministic public-safe vs redacted vs blocked rules,
- emits a stable redacted artifact hash.

## Acceptance criteria
Task-1 oracle-resistance slice is complete when:
1. normal primary/backup output with safe detail budget yields `tactic-output-public-safe`,
2. degraded output with excessive candidate/route detail yields `tactic-output-redacted`,
3. hostile blocked case yields `tactic-output-blocked`,
4. identical bundles produce identical artifact hash,
5. `bun test` for the new slice passes,
6. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** eliminate all observability,
- do **not** hide trust semantics from honest consumers,
- do **not** claim oracle resistance is complete after this slice.

## Why this matters
The key question is not only **"what is the correct output mode?"**
It is also **"does the surrounding system behavior leak more than it should?"**

That is the difference between an honest artifact and an accidental verifier oracle.

## Next Task
Lane F: red-team the output oracle-resistance gate for coarse-grained leakage, over-redaction, and route-state inference abuse.
