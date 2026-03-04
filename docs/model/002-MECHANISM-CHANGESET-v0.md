# Mechanism Changeset v0 (Contract + Runtime)

**Date:** 2026-03-04  
**Scope:** Practical changes from current v4.2 behavior  
**Anchor:** Reduce short-settle dominance from resultTypes 2/4/7.

---

## A. INVALID_SOLUTION (2) — Solve Reliability Gate

### Problem
Battle ends immediately on bad solution submission.

### Proposed changes
1. **Runtime preflight gate (must pass):**
   - solver output exists,
   - output validated against current VOP params,
   - payload hash fixed before tx send.
2. **One bounded infra retry:**
   - if RPC/nonce failure, retry once,
   - never send with unknown or placeholder solution.

### Abuse check
- Prevents "send anything fast" scripts from accidental survival.

---

## B. TIMEOUT (4) — Stall EV Suppression

### Problem
Timeout paths can become strategically attractive for low-adaptation play.

### Proposed changes
1. **Timeout debt counter per side (windowed):**
   - increments on repeated timeout-pattern outcomes,
   - decays after compliant active turns.
2. **Asymmetric stall penalty:**
   - no heavy punishment for one-off delays,
   - stronger penalty for repeated low-information stall profile.

### Abuse check
- Avoid griefing honest agents with occasional latency hiccups.

---

## C. NCC_REVEAL_FAILED (7) — Reveal Liveness Hardening

### Problem
Operational reveal failure causes fast settle/forfeit.

### Proposed changes
1. **Durable reveal checkpoint persistence** before send.
2. **Reveal preflight invariant check** (`phase`, ownership, commitment compatibility).
3. **One-shot reveal fallback** with same commitment privacy.

### Abuse check
- fallback must not reveal extra strategic info,
- no unlimited retries.

---

## D. Ranked Anti-Template Layer (Minimal)

### Optional but recommended
- Keep mandatory structural challenge constraints (e.g., cloze/canary) deterministic,
- prefer **economic pressure** (soft penalties) over brittle hard semantic gates.

---

## E. Acceptance Gates (Ship Criteria)

Each patch batch is accepted only if a rolling-window metric artifact shows:

- `rate(2)` reduced vs baseline,
- `rate(4)` reduced without grief spike,
- `rate(7)` reduced,
- short-settle (`turn <= 1`) share reduced,
- no liveness regression.

---

## F. Suggested Rollout Order

1. Solve reliability gate (fastest impact on obvious losses).  
2. Reveal liveness hardening (stabilize honest runs).  
3. Timeout EV suppression (requires careful calibration).  
4. Ranked anti-template penalties tuning.

---

## G. Proof Required Per Rollout

- contract/runtime diff,
- tests added/updated,
- battle-window metric artifact,
- at least one live tx-backed demonstration.
