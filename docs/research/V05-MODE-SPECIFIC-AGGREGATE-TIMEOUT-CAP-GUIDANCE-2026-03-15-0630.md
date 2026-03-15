# V05 mode-specific aggregate timeout-cap guidance — 2026-03-15 06:30 UTC

## Research question
Should aggregate timeout-allowance cap thresholds be mode-specific (`script-vs-script`, `agent-vs-script`, `agent-vs-agent`) to avoid miscalibrated liveness gating?

## Signal summary
External SRE/error-budget material was mixed but consistently points to workload-class-aware thresholds and multi-window burn semantics rather than one global static threshold.

## Decision
**Yes: aggregate timeout caps should be mode-specific.**

A single aggregate cap risks:
- false positives in higher-latency agent modes,
- false negatives in low-latency script modes.

## Proposed initial deterministic aggregate caps
- `script-vs-script`: aggregate cap = **8** timeout allowance units
- `agent-vs-script`: aggregate cap = **12**
- `agent-vs-agent`: aggregate cap = **16**

These are conservative policy defaults and should be revised only via measured artifact evidence.

## Deterministic policy rules
1. Aggregate cap is selected from mode profile (not per-run free-form input).
2. Existing trigger remains canonical on exceed:
   - `hard-invalid:timeout-allowance-aggregate-exceeded:budget-<x>:used-<y>`
3. Mode id + cap value must be included in rule hash/version for auditability.
4. If mode is unknown, fail-closed to strictest cap (`script-vs-script` baseline).

## Acceptance criteria for next build/verify slice
- Fixture A (`script-vs-script`, used=9) => exceed trigger with budget 8.
- Fixture B (`agent-vs-script`, used=9) => no exceed trigger with budget 12.
- Fixture C (`agent-vs-agent`, used=17) => exceed trigger with budget 16.
- Markdown/json both surface mode + aggregate budget + used values.

## Posting decision
No external post (internal calibration guidance only).
