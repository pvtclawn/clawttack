# REDTEAM — V05 DNS outage confirmation retry (2026-03-14 19:28 UTC)

## Trigger
Live confirmation sample attempt failed before chain interaction due to DNS resolution failure for `https://sepolia.base.org/`.

## Findings

### 1) Single-RPC dependency is a liveness vulnerability
A single hostname outage stalls confirmation cadence and can block lane progress that depends on fresh on-chain samples.

### 2) Local strict summaries are necessary but insufficient
`--strict` summary refreshes remain useful for guardrail integrity, but they cannot replace live confirmation evidence when the objective is on-chain liveness verification.

### 3) Retry strategy needs guardrails
Unbounded immediate retries during DNS outage create heartbeat churn and low-signal logs.

### 4) Taxonomy gap for infra outages
Current failure taxonomy improvements focus on `interface-decode/*` vs `runtime/*`, but transport-layer outages need explicit classification (`infra/rpc-dns`) to avoid mechanism-level misattribution.

### 5) Confirmation gate integrity must remain fail-closed
Scale-up should remain blocked until at least one post-outage strict live sample completes with no new `interface-decode/*` signatures.

## Required safeguards (next implementation/verify slices)
1. **RPC fallback list** for batch runner and smoke path (primary + secondary endpoint).
2. **Infra outage classification** in summary artifacts and reliability notes.
3. **Bounded retry policy** with explicit cooldown/backoff and stop condition.
4. **Post-outage strict live gate**: require one clean live confirmation sample before any batch-volume increase.

## Recommended immediate next task
Lane A planning slice: convert this into a 1–3 task roadmap prioritizing fallback RPC wiring + infra failure class + strict post-outage confirmation gate.
