# 090 — Timeout Clock-Source Consistency Gate Plan (2026-03-11)

## Context
Timeout-evidence classification currently risks ordering mistakes when wall-clock timestamps are treated as strongly ordered across components/providers.

Distributed-systems timing reality:
- physical clocks drift/skew,
- time-of-day clocks can move backward,
- timeout certainty collapses when clock deviation is unknown.

## Objective
Add deterministic clock-source consistency checks so timeout-evidence ordering is robust against backward time movement and cross-node timestamp ambiguity.

## Task (single, merge-sized)
Implement simulation/tooling evaluator for timeout clock-source consistency:
- deterministic outcomes:
  - `timeout-clock-source-pass`
  - `timeout-clock-source-backward-time`
  - `timeout-clock-source-cross-node-uncertain`

## Core rules
1. Intranode ordering must use monotonic progression checks (non-decreasing monotonic deltas).
2. If wall-clock indicates backward movement for same node stream, fail deterministic with `timeout-clock-source-backward-time`.
3. If ordering depends on cross-node wall-clock comparison without reliable synchronization guarantees, downgrade deterministic outcome to `timeout-clock-source-cross-node-uncertain`.
4. Identical tuples must produce identical verdict + artifact hash.

## Acceptance criteria
1. Same-node backward time fixtures fail with `timeout-clock-source-backward-time`.
2. Cross-node wall-clock-only ordering fixtures return `timeout-clock-source-cross-node-uncertain`.
3. Monotonic-consistent same-node traces pass with `timeout-clock-source-pass`.
4. Identical input tuples yield deterministic verdict and artifact hash.

## Non-goals
- No runtime scheduler replacement in this slice.
- No on-chain schema changes in this slice.

## Next Task
Lane F: red-team timeout clock-source consistency gate for monotonic-counter forgery, mixed-source ordering confusion, and uncertainty laundering.
