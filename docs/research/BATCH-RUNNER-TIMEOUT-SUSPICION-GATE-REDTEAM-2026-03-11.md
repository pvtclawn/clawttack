# Batch Runner Timeout Suspicion Gate — Red-Team Report (2026-03-11)

## Scope
Target plan:
- `docs/model/086-RUNNER-TIMEOUT-SUSPICION-GATE-PLAN-2026-03-11.md`

Goal: identify how timeout classification can be gamed so the runner either (a) falsely confirms failures or (b) clears unsafe states too early.

## Findings

### 1) False-confirmation spoofing via correlated probes
**Vector:** attacker or bad infra path causes multiple probes (tx status + state probe + alt RPC) to return the same stale/error-shaped response, creating the illusion of independent confirmation.

**Failure mode:** gate emits `runner-timeout-confirmed-failure` even though operation is only delayed or pending on canonical chain.

**Mitigation:** enforce probe independence policy (distinct providers/classes), and require anti-correlation checks before confirmed-failure classification (`runner-timeout-confirmation-correlation-risk`).

---

### 2) Probe-divergence laundering
**Vector:** mixed probe outcomes are selectively reduced to the most convenient one (e.g., one failed probe dominates two uncertain probes).

**Failure mode:** ambiguous evidence collapses into deterministic success/failure instead of suspect state.

**Mitigation:** add strict divergence precedence rule: conflicting probe classes must produce suspect outcome (`runner-timeout-suspect-divergent-probes`) until convergence threshold is met.

---

### 3) Backoff-state laundering (retry metadata tampering)
**Vector:** runner/worker reports manipulated retry counters or backoff phase (reset to low retry count, fake jitter phase) to avoid failure thresholds.

**Failure mode:** repeated timeouts never escalate to confirmed failure, or escalate too late for operational safety.

**Mitigation:** bind retry/backoff metadata to append-only operation trace hash and reject regressions (`runner-timeout-backoff-state-invalid`).

---

### 4) Observation-window edge gaming
**Vector:** operation timing is nudged to sit just outside/inside fixed windows (boundary hugging), causing oscillation between suspect/cleared states.

**Failure mode:** classification flaps, producing unstable control actions and noisy recovery logic.

**Mitigation:** add hysteresis and minimum dwell time for state transitions (`runner-timeout-window-flap-detected`).

---

### 5) Cleared-state spoof after partial recovery
**Vector:** one successful low-confidence check is treated as full recovery while stronger confirmation channels remain stale/unavailable.

**Failure mode:** gate emits `runner-timeout-cleared` prematurely and unsafe retries resume.

**Mitigation:** require class-weighted recovery quorum before cleared verdict (`runner-timeout-cleared-insufficient-quorum`).

## Proposed hardening tasks
1. Probe-independence + anti-correlation confirmation checks.
2. Divergence-first precedence + append-only backoff-state integrity.
3. Hysteresis/dwell controls + weighted recovery quorum for clear-state decisions.

## Acceptance criteria for next lane
- Correlated multi-probe fixtures fail with `runner-timeout-confirmation-correlation-risk`.
- Divergent probe fixtures return `runner-timeout-suspect-divergent-probes`.
- Backoff-state regression fixtures fail with `runner-timeout-backoff-state-invalid`.
- Window-boundary flap fixtures fail with `runner-timeout-window-flap-detected`.
- Partial-recovery fixtures fail with `runner-timeout-cleared-insufficient-quorum`.
