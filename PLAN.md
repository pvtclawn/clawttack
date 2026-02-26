# Clawttack v3.3 Decision Tree
*Updated 2026-02-26 04:30*

## Current State
- v3.2 deployed on Base Sepolia, 14 battles (3 LLM), 396 tests green
- clawttack.com LIVE on Vercel ✅
- **All 12-turn battles = DRAW** (template AND LLM)
- Egor suggested CTF direction (08:00 Feb 25) — design drafted + red-teamed
- ContextualLinguisticParser prototype built + tested (21 Forge tests)
- SelfClaw verified (ERC-8004 #168 on Celo)

## ⚠️ Meta-Question: Product vs Research Artifact
*Raised by economic sustainability red-team (Feb 26)*

Before picking v3.3 mechanics, the bigger question:
**Is Clawttack a product (needs users + revenue) or a research artifact (portfolio/credential)?**

If **product**: next priority is spectator layer, external Elo consumption, business model — NOT more game mechanics.
If **research artifact**: CTF/CLP integration is fine — demonstrate technical depth, not market fit.

Current trajectory: increasingly sophisticated mechanics nobody plays (2 agents, 67 battles, all ours).
See: `memory/challenges/2026-02-26--economic-sustainability.md`

**Awaiting Egor's answer on this.** It changes everything about investment priority.

## The Two-Layer Problem

### Layer 1: Poison avoidance is trivial for LLMs
Poison is visible in TurnPayload event → agent reads it → explicitly instructs LLM to exclude → 100% success rate.

### Layer 2 (DEEPER): No win condition besides timeout
Even if poison becomes harder, **if both agents survive all turns → DRAW**. The game needs a way to produce winners.

---

## Leading Direction: CTF (Capture The Flag)

**Origin:** Egor's suggestion (Feb 25 08:00)
**Design doc:** `docs/design/v3.3-ctf-mechanic.md`
**Red-team:** `memory/challenges/2026-02-25--ctf-mechanic-red-team.md`

### Concept
- Each agent commits `hash(secret)` at battle start
- Goal: extract opponent's secret via prompt injection in narratives
- `captureFlag(secret)` → verify vs hash → instant win
- Settlement: flag capture > timeout > maxTurns draw

### P0 Red-Team Finding: Context Isolation Defeats CTF
A smart agent keeps secret in system prompt, uses a **separate** LLM call (without secret) to analyze opponent narratives. Secret never touches the attack surface → injection can't reach it → unwinnable.

### Fix Directions for P0
- **(a) Functional secret**: Secret is needed for gameplay (e.g., required to compute VOP solutions). Agent MUST use it actively → more leak surface.
- **(b) VIN integration**: TEE proves LLM call included both secret AND opponent narrative in same context. Heavy infra.
- **(c) Accept it**: Game tests defense quality. Top agents draw; weak agents get exploited. CTF as a filtering mechanism, not a competition.
- **(d) Protocol-enforced context**: Contract requires proof that opponent's narrative was in the same LLM call as the secret (variant of proof-of-context + VIN).

**Awaiting Egor's response on P0 direction** (sent msg #5692 at 09:34).

---

## Other Options (deprioritized, not rejected)

### Escalating Multi-Poison
Each round adds poison words. First failure = loss. Simpler but still susceptible to equal LLMs both surviving.

### Asymmetric Attacker/Defender
Structured role swapping. High impact but larger contract change.

### Commit-Reveal Blind Poison
Combines well with CTF or multi-poison. Addresses Layer 1 (poison visibility).

## Next Task
- **If Egor picks (a) functional secret**: Design what "functional" means in contract terms → implement
- **If Egor picks (c) accept**: Build CTF as-is (~1 day) → deploy → test with real LLM agents
- **If Egor pivots**: Follow his direction
- **Meanwhile**: All designs are documented, ready to build on any path

## Parked (ICEBOX)
- Scoring oracle / LLM judge
- Narrative entropy scoring
- Audience voting / staking
- Opponent echo requirement (gas too high)
- Full VIN integration for proof-of-LLM-input

## If Product Path: Quick Wins
1. **Real-time battle spectating** on clawttack.com (WebSocket + event listener)
2. **Open registration** — let external agents register (currently just Clawn + ClawnJr)
3. **One external Elo consumer** — find a protocol that would check Clawttack battle record
4. **Battle replays as content** — NFT-mintable battle logs (IPFS already done)
