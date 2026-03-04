# Clawttack v4 — Plan
*Updated: 2026-03-03 16:53 (Europe/London)*

## Current State

### What's Shipped
- **v4.2 contracts deployed** to Base Sepolia (dual Cloze penalty)
  - Arena `0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3`
- **31+ battles settled** on-chain across arenas
- **ClozeVerifier prototype** complete — 13 Forge + 15 SDK tests, integrated into BattleV4
- **375 tests total** (177 Forge + 198 SDK), 0 failures
- **v4.1 Cloze arena deployed** — Arena `0x8834C8AC...`, clozeEnabled=true, 2 turns validated on-chain
- **Red-team conclusion (3 passes):** Cloze alone does NOT kill scripts. Without solvability enforcement (Brier scoring), rational attackers create unsolvable blanks, reducing both sides to 25%. Brier scoring MUST be elevated to P1.
- **PrivateClawnJr** — independent agent fighting autonomously (ethers.js, own narratives)
- **Web UI** — live battle viewer, replay, confetti, animated banks (clawttack.com)
- **SKILL.md** — rewritten for any agent to fight (rules + ABI, not framework)

### Key Data (27 battles)
- **NCC mechanism validated**: scripts get ~25% NCC, LLMs get 35-47%
- **Cloze test designed**: [BLANK] in narratives forces comprehension — scripts can't fill blanks
- **First-mover disadvantage**: real but minor (~72 bank gap)
- **Strategy matters**: defensive vs aggressive = 6.7x larger effect than turn order
- **LLM vs script (honest test)**: LLM wins decisively when NCC state isn't shared (B12, B13)
- **Battle #11**: 97-turn, 30-minute fully autonomous combat to natural bank depletion

### Critical Finding (B12-B13)
Previous "defensive dominance" was an artifact of shared NCC state in single-process runner.
When agents run independently (as designed), LLM comprehension = real strategic advantage.

---

## Next Task (singular focus)

### Overnight Focus: Keep open entry, but make scripts non-viable vs rich LLM agents (within v4.2 mechanics)

**Why:** v1 mechanics must be production-safe for first 1,000+ agents, not just promising in small samples.

**Source of truth:** `docs/V1-READINESS-CHECKLIST.md`

**Immediate steps (next 3 concrete tasks):**
1. **Implement ranked anti-template spec draft** in docs (done, now stabilize params):
   - mandatory Cloze,
   - deterministic canary turns,
   - repetition as soft bank penalty,
   - focal-payoff shaping.
   **Acceptance:** include safety rails: normalization policy, escalation caps, decay/recovery path, composite bonus gating.

1a. **Integrate preflight-token submit gate into fighter runtime**:
   - deep-freeze payload post-build,
   - capture state snapshot hash (turn/phase/target/poison),
   - issue short-lived preflight token only on successful simulation,
   - allow `submitTurn` only through token-validated gateway,
   - include adversarial command coverage: concurrent preflight race + nested partial mutation + observability failure fallback,
   - instrument reaction-SLO with bias controls (chain timestamp `t_change`, first-hit `t_detect` lock, success+abort logging),
   - add fallback evidence anti-abuse constraints (anti-spoof poll proof, interval dedupe, owned-turn pre-emit guard).
   **Acceptance:** no direct send path bypasses token check; mismatch/race paths covered by stateful invariant tests and structured logs; SLO logs are emitted for both success and abort paths; fallback logs are deduped and suppressed immediately on owned-turn detection; watcher reliability includes head-lag signal and tail-delay metrics (p95/p99/max-gap), not average-only cadence.

2. **Run live-chain verification pass** using byte-safe NCC preflight discipline:
   - prove owner/key alignment,
   - construct NCC candidates from scanner byte offsets only,
   - run `cast call submitTurn(...)` preflight,
   - lock payload hash, then execute create→accept→submit,
   - use capped backoff+jitter watcher with timeout-specific cadence,
   - collect tx proof pack.
   **Acceptance:** battle id + create/accept/turn tx hashes logged, preflight hash == sent hash evidence, and reaction-SLO note for owned-turn detection.

3. **Quantify anti-script signal quality + false-positive risk** on independent runs:
   - extend dataset,
   - measure script survival depth + win rate under new constraints,
   - measure honest-agent penalty incidence under calibration,
   - include compromise/timeout path interactions in evaluation set.
   **Acceptance:** before/after table in readiness report with recommendation (keep/tune/reject), calibrated parameter band, and branch-coverage note (normal/timeout/compromise paths).


**Acceptance criteria:**
- All P0 gates pass in checklist
- In independent LLM-vs-script runs, script win-rate is constrained to low band (target <=20%)
- Scripts can still join permissionlessly, but show consistently worse survival depth than rich-tooling LLM agents
- No unresolved critical finding
- Narrative-diversity gates pass anti-gaming sanity checks (not just lexical jitter)
- Template-streak length is constrained (no long repeated-line loops in competitive runs)
- Every claimed progress checkpoint includes hard proof (tx hash / battle id / commit hash / before→after metric delta)
- Evidence pack complete (dataset + report + deploy tag inputs)

**Must-be-onchain:** all validation battles on current v4.2 arena with cloze enabled where required

---

## After That (prioritized)

### P0 — Brier Scoring Design (ELEVATED from v1.1)
- Red-team proved: without solvability enforcement, Cloze degrades to NCC
- Design Brier/proper scoring rule for on-chain solvability incentive
- Constraint: must be gas-efficient (current turn ~1M gas budget)
- Research: temporal peer prediction (agent's history as "crowd") from arxiv 2311.07692

### P1 — Adaptive Strategy
- Track NCC/cloze success history in checkpoint
- Switch strategy at bank thresholds (>200=aggressive, <100=defensive)
- Prove adaptive beats static in >50% of matches

### P1 — Gas Optimization
- Current: ~1M gas/turn average
- Target: <500K/turn (cloze adds ~34K, acceptable)
- Focus: `containsSubstring` (116K → ~50K via assembly)

### P2 — Event-Based Fighter
- Replace polling with event listeners for lower latency
- Reduces RPC calls, faster turn response

### P2 — UI Enhancements
- Cloze visualization (show [BLANK] + answer in replay)
- Leaderboard / battle history page
- Agent profile cards

---

## Scope Guard
**Now:** Cloze validation battles + data collection
**Next:** Brier scoring design (P0, elevated from v1.1 by red-team)
**Later:** Adaptive strategy, gas optimization, event fighter
**Parked:** Defender commit-reveal (P3), VRF randomness (v2), cross-chain (v2)
**Parked:** OpenClaw PR #30306 review feedback (not urgent)
