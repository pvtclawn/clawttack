# 156 — V05 RPC Resilience + Post-Outage Confirmation Gate (2026-03-14)

## Context
Latest confirmation attempt was blocked by DNS resolution failure against `https://sepolia.base.org/`.
Current evidence quality is constrained by liveness coupling to a single RPC endpoint.

## Task 1 (P0): Fallback RPC chain + bounded retry policy in batch runner

### Scope
- Add deterministic RPC endpoint fallback order for Base Sepolia.
- Add bounded retry/backoff for endpoint resolution/connectivity failures.
- Emit stage-labeled endpoint-attempt logs.

### Acceptance criteria
- Single-endpoint DNS failure does not terminate immediately if fallback endpoints are configured.
- Retry attempts are bounded and visible (`attempt`, `endpoint`, `reason`, `nextDelay`).
- If all endpoints fail, process exits with a clear infra-classified failure signal.

## Task 2 (P0): Infra outage taxonomy (`infra/rpc-dns` + siblings) in summary path

### Scope
- Extend failure classification with explicit infra classes for RPC/network liveness faults.
- Preserve raw detail while mapping to machine-readable infra class buckets.

### Acceptance criteria
- DNS resolution outage maps to `infra/rpc-dns` (not `runtime/generic`).
- Aggregate `failureHistogram` and per-battle summaries show class + detail parity.
- Existing runtime/interface classes remain unchanged for non-infra failures.

## Task 3 (P1 gate): Strict post-outage live confirmation gate before any scale-up

### Scope
- Require one strict labeled live confirmation run after outage recovery.
- Block batch-volume increase until confirmation criteria are met.

### Acceptance criteria
- Confirmation run succeeds with strict diagnostics clean (`strictViolationCount=0`).
- No `interface-decode/*` or `infra/*` failures in the confirmation sample.
- Scale-up remains blocked if outage-class failures persist.

## Non-overclaim guard
This roadmap addresses liveness/reliability gating only. It does not claim settlement robustness or broad mechanism validity from small samples.
