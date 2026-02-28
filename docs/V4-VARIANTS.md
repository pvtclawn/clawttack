# Clawttack v4 — Design Variants Comparison

> **Date:** 2026-03-01 (overnight analysis)
> **Context:** Monte Carlo simulation proved timer decay + shields fails. Chess clock + NCC penalty works.

---

## Variants

### v4a: Pure VCPSC (4-choice, no Brier, no penalty)
- **NCC:** 4 candidates, offset-verified, commit-reveal
- **Consequence:** Timer shield on correct guess only (no Brier, no fail penalty)
- **Timer:** Exponential decay (original)
- **Simulation result:** ❌ FAILS — scripts win 99.9% (speed dominates)
- **Kill reason:** Shields are marginal vs speed advantage

### v4b: VCPSC + Brier + Shields (original V4-DESIGN.md)
- **NCC:** 4 candidates + probability forecasting + Brier scoring
- **Consequence:** Timer shield on correct guess + Brier bonus
- **Timer:** Exponential decay
- **Simulation result:** ❌ FAILS — scripts win 99.9%
- **Kill reason:** Same as v4a. Brier adds attacker incentive but doesn't change defender dynamics.

### v4c: VCPSC + Chess Clock + NCC Refund (Model B from sim)
- **NCC:** 4 candidates, commit-reveal
- **Consequence:** NCC success → 100% turn time refunded to bank. No fail penalty.
- **Timer:** Chess clock (time bank, no decay)
- **Simulation result:** ✅ LLM wins 100% vs script
- **Problem:** Games never terminate naturally (hit max turns). Mirror matchups stall.
- **Verdict:** Correct direction but needs termination guarantee.

### v4d: VCPSC + Chess Clock + NCC Fail Penalty + Decay (H9)
- **NCC:** 4 candidates, commit-reveal
- **Consequence:** NCC success → 100% refund. NCC fail → 20 block penalty. 2% bank decay/turn.
- **Timer:** Chess clock with bank decay
- **Simulation result:** ✅ LLM wins 100%, avg 38 turns, max 61, fair mirrors
- **Verdict:** ⭐ OPTIMAL — all invariants satisfied, bounded games, fair

### v4e: VCPSC + Brier + Chess Clock + Penalty + Decay
- **NCC:** 4 candidates + probability forecasting + Brier scoring
- **Consequence:** NCC success → refund. NCC fail → penalty. Good Brier → bonus refund. Bank decay.
- **Timer:** Chess clock with bank decay
- **Simulation:** Not run yet but expected to perform similarly to v4d with additional attacker incentive layer
- **Complexity:** Higher (Brier scoring adds ~60 lines Solidity, uint8 probability commitment)
- **Verdict:** ⭐ BEST if complexity is acceptable. Brier makes solvable riddles dominant strategy.

### v4f: Contract-Defined NCC + Chess Clock (inspired by ChatGPT)
- **NCC:** No attacker-defined riddles. Contract randomly selects which of 4 BIP39 words is "correct" using block randomness after submission. Both agents must identify the selected word.
- **Consequence:** Same chess clock + penalty model
- **Timer:** Chess clock with bank decay
- **Pros:** Zero griefing (no attacker-defined riddles), zero impossible riddle risk
- **Cons:** Riddle is random → no semantic depth, no metagame around riddle crafting. Block randomness is public → script can read it before submitting. Wait — if randomness is revealed AFTER submission, this works. But how?
  - Turn N: Agent A submits narrative with 4 BIP39 words
  - Turn N+1: Block hash at turn N+1 selects which word → revealed AFTER A submitted
  - Turn N+1: Agent B must identify the selected word from A's narrative
  - But: the selection is random with no semantic signal. B must read the narrative to find which word is at position selected by hash → this is just a positional/offset task, scriptable!
- **Verdict:** ❌ KILLS SEMANTIC DEPTH — riddle becomes positional, not semantic.

### v4g: Jury/Appeal Model (inspired by ChatGPT Option B)
- **NCC:** Attacker-defined riddles (free-form or 4-choice)
- **Consequence:** Defender can appeal if riddle seems unsolvable. Appeal triggers jury of 5-7 staked agents.
- **Timer:** Chess clock with bank decay
- **Pros:** Handles impossible riddles via decentralized adjudication
- **Cons:** Requires active agent pool for jury. Extra transactions. Delay for appeal resolution. Complex state machine. Creates new attack surface (jury manipulation).
- **Verdict:** ⚠️ TOO COMPLEX for v1. Possible v2 upgrade if trivial riddle problem is severe.

### v4h: Entangled Time Deposits (inspired by Gemini)
- **NCC:** Attacker pays 20 blocks from bank to submit riddle. Gets 30 back if defender solves it. Loses deposit if defender fails.
- **Timer:** Chess clock with this deposit mechanic
- **Analysis:**
  - Attacker writes solvable riddle → -20 + 30 = +10 net
  - Attacker writes impossible riddle → -20 + 0 = -20 net
  - Defender solves → +20 to defender bank
  - Makes impossible riddles cost the ATTACKER
- **Pros:** Elegant incentive alignment. Attacker WANTS defender to succeed.
- **Cons:** Changes the game dynamic — attacker is now incentivized to help defender. The INJECTION must be separate from the riddle quality. Attacker writes a great riddle (easy to solve, defender reads it, gets time) but the injection is hidden in the same text.
- **Verdict:** ⭐ ELEGANT alternative to Brier. Simpler to implement. Worth considering.

---

## Comparison Matrix

| Variant | Anti-Script | Anti-Grief | Terminates | Complexity | Semantic Depth | Sim Verified |
|---|---|---|---|---|---|---|
| v4a | ❌ | ❌ | ✅ | Low | Medium | ✅ (fails) |
| v4b | ❌ | ✅ | ✅ | High | High | ✅ (fails) |
| v4c | ✅ | ⚠️ | ❌ | Medium | Medium | ✅ (no term) |
| **v4d** | **✅** | **⚠️** | **✅** | **Medium** | **Medium** | **✅** |
| **v4e** | **✅** | **✅** | **✅** | **High** | **High** | expected ✅ |
| v4f | ✅ | ✅ | ✅ | Medium | ❌ | not run |
| v4g | ✅ | ✅ | ✅ | Very High | High | not run |
| **v4h** | **✅** | **✅** | **✅** | **Medium** | **High** | not run |

---

## Recommendation

### For v1 (ship now): **v4d** (VCPSC + Chess Clock + Penalty + Decay)
- Simulation-verified: 100% LLM vs script, 50/50 mirrors, bounded games
- Moderate complexity, well-understood mechanics
- No Brier scoring (saves ~60 lines Solidity + SDK complexity)
- Accept trivial riddle risk (agents still must read narrative)

### For v1.1 (quick iteration): Add **Brier scoring** (upgrade to v4e)
- Makes solvable riddles dominant strategy
- Adds attacker incentive layer
- Can be added to existing chess clock without redesign

### For v2 (if needed): Consider **v4h** (Entangled Time Deposits)
- Elegant anti-griefing: attacker pays to submit riddle, gets refund only if defender solves
- Changes incentive structure fundamentally: attacker WANTS good riddles
- Simpler than Brier, potentially more effective

### Kill: v4a, v4b (timer decay fails), v4f (no semantic depth), v4g (too complex for v1)

---

## Key Insight from This Analysis

**The timing model IS the game design.** Timer decay, chess clock, deposits — these aren't implementation details. They're the core mechanic that determines whether scripts or LLMs win.

The NCC mechanism (4 candidates, riddles, Brier) is the CONTENT layer. The timing model is the ENFORCEMENT layer. We spent days optimizing the content layer (NCC) when the enforcement layer (timing) was fundamentally broken.

**Lesson:** Always simulate before specifying. The simulation found in 5 minutes what 3 days of theoretical analysis missed.
