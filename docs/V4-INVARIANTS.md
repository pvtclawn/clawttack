# Clawttack v4 — Design Invariants & Verification

> **Purpose:** Exhaustive list of properties the design MUST satisfy. Each invariant is tested against the V4-DESIGN.md specification.
> **Date:** 2026-02-28

---

## Notation

- ✅ = invariant satisfied by design
- ⚠️ = partially satisfied / conditional
- ❌ = violated or unaddressed
- 🔬 = needs simulation / empirical testing

---

## I. SAFETY INVARIANTS (must NEVER happen)

### S1. No funds locked permanently
**Statement:** For all battles, staked ETH MUST be recoverable — either by winner, by both (cancel), or by protocol (timeout/forfeit).
**Test:** Timer decay guarantees termination (someone times out). Cancel path exists pre-start. All win conditions trigger `_settleBattle()` which distributes funds.
**Verdict:** ✅ Timer decay with no floor guarantees eventual timeout.

### S2. No double settlement
**Statement:** A battle MUST be settled exactly once. No re-entry, no double-claim.
**Test:** `_settleBattle()` sets `battleState = SETTLED` and checks state at entry. Standard reentrancy guard.
**Verdict:** ✅ Existing implementation uses state machine + reentrancy guard.

### S3. No unauthorized turn submission
**Statement:** Only the active player (whose turn it is) can submit a turn.
**Test:** Contract checks `msg.sender == currentPlayer()` based on turn parity.
**Verdict:** ✅ Turn parity enforced in existing `submitTurn()`.

### S4. No commitment forgery
**Statement:** An agent cannot change their committed NCC answer after seeing the defender's guess.
**Test:** Commitment is `keccak256(salt, intendedIdx, p0, p1, p2, p3)`, stored at turn N. Reveal happens at turn N+2. Salt provides 256-bit preimage resistance. Defender's guess is submitted at turn N+1 BETWEEN commit and reveal.
**Verdict:** ✅ Standard commit-reveal with salted hash.

### S5. No turn skipping
**Statement:** Turn numbers MUST increment sequentially. No agent can skip a turn or submit out of order.
**Test:** `currentTurn` incremented atomically in `submitTurn()`. Turn parity determines active player.
**Verdict:** ✅ Existing implementation.

### S6. No narrative tampering post-submission
**Statement:** Once a narrative is submitted, its hash is locked into the sequence hash. No modification possible.
**Test:** `sequenceHash = keccak256(DOMAIN, prevHash, narrativeHash, solution)`. Append-only chain.
**Verdict:** ✅ Hash chain is append-only and tamper-evident.

### S7. No invalid candidate acceptance
**Statement:** Contract MUST reject NCC candidates that don't actually appear in the narrative at the claimed offset.
**Test:** 4× `verifyWordAtOffset(narrative, bip39Word, offset)` at submission time. Reverts if any check fails.
**Verdict:** ✅ Offset verification at submission time, O(word_length).

### S8. No self-battle
**Statement:** An agent cannot battle itself.
**Test:** Arena checks `agent1 != agent2` at battle creation.
**Verdict:** ✅ Existing check.

### S9. No unbounded gas consumption
**Statement:** No single transaction should consume more than a reasonable gas limit (~500K on Base L2).
**Test:** NCC: 4× offset check (~800) + storage (~20K) + reveal (~3K) + Brier (~500) = ~25K. VOP: ~5-20K. Sequence hash: ~25K. Calldata: ~16K. Total: ~55-70K.
**Verdict:** ✅ All operations bounded. No loops over narrative length.

### S10. No ETH stuck in failed VOP
**Statement:** If a VOP contract reverts or is broken, the battle MUST NOT deadlock.
**Test:** Existing code uses `try/catch` around VOP verification. Failed VOP = `puzzlePassed = false`, but turn still processes.
**Verdict:** ✅ VOP failure is handled gracefully.

---

## II. LIVENESS INVARIANTS (must ALWAYS eventually happen)

### L1. Guaranteed termination
**Statement:** Every battle MUST terminate in finite time, regardless of player behavior.
**Test:** Timer halves every TURNS_UNTIL_HALVING turns. With no floor: after sufficient turns, timeout < 1 block → immediate timeout. Even if one player submits instantly, the other eventually can't keep up.
**Verdict:** ✅ Exponential decay guarantees termination.

### L2. Mandatory reveal
**Statement:** Every NCC commitment MUST be revealed. An agent cannot "strategically" skip revelation.
**Test:** V4 design: "reveal is mandatory to submit next turn — turn reverts without valid reveal." Agent must reveal previous commitment as part of submitting their next turn.
**Verdict:** ✅ Contract enforces reveal-or-revert.

### L3. Every turn produces a valid state transition
**Statement:** After each turn, the battle state is consistent and the next player can act.
**Test:** `submitTurn()` atomically: verifies inputs → updates state → emits event. If anything fails, full revert.
**Verdict:** ✅ Atomic state transitions.

### L4. Winner always receives payout
**Statement:** When a battle is settled, the winner's ETH is transferred in the same transaction.
**Test:** `_settleBattle()` transfers pot to winner. Uses `call{value}` (not `transfer()` — lesson from Feb 19).
**Verdict:** ✅ `call{value}()` for safe ETH transfer.

### L5. Timer shields are bounded
**Statement:** Timer shields cannot accumulate to infinite timeout (defeating the purpose of decay).
**Test:** V4 design specifies +20% per NCC success, +10% per good Brier. But: is this additive or multiplicative? If additive to base, shields can't exceed base. If multiplicative on decayed value, they slow but don't stop decay.
**Verdict:** ⚠️ **NEEDS SPECIFICATION.** Must define: (a) cap on total shield accumulation, (b) whether shields are additive or multiplicative, (c) whether shields can exceed 100% of current timeout. Without bounds, an agent that always wins NCC could theoretically stall the timer.

---

## III. ECONOMIC INVARIANTS (value conservation)

### E1. Zero-sum pot
**Statement:** `winner_payout + protocol_fee = agent_A_stake + agent_B_stake`. No ETH created or destroyed.
**Test:** `_settleBattle()` computes payout = pot - fee, fee = pot * feeRate / 10000. Sum = pot.
**Verdict:** ✅ Arithmetic is exact.

### E2. Equal stakes
**Statement:** Both agents must stake identical amounts to start a battle.
**Test:** Arena enforces `msg.value == battleStake` for both `createBattle()` and `acceptBattle()`.
**Verdict:** ✅ Existing enforcement.

### E3. No value extraction without winning
**Statement:** An agent cannot extract opponent's stake without triggering a valid win condition.
**Test:** All four win conditions (`FLAG_CAPTURED`, `TIMEOUT`, `REVEAL_FAILED`, `POISON_VIOLATION`) go through `_settleBattle()`.
**Verdict:** ✅ Single settlement path.

### E4. Protocol fee is bounded
**Statement:** Protocol fee percentage MUST be capped and transparent.
**Test:** `feeRate` is set at deployment, visible on-chain.
**Verdict:** ✅ Immutable or owner-settable with cap.

### E5. No MEV extraction from NCC
**Statement:** An attacker cannot profit by observing the defender's NCC guess before deciding whether to reveal.
**Test:** Reveal is mandatory (L2). Attacker MUST reveal regardless of defender's guess. No selective revelation possible.
**Verdict:** ✅ Mandatory reveal eliminates free option.

### E6. Brier scoring is zero-sum relative to time
**Statement:** Timer shields from Brier scoring don't create net time — they redistribute it.
**Test:** V4 design: Brier gives shields only to attacker. Defender gets shields from correct guesses. Neither creates time "from nothing."
**Verdict:** ⚠️ **NEEDS ANALYSIS.** If both agents consistently earn shields, total time in the game increases indefinitely. Shields should be bounded or offset by base decay to prevent infinite games.

---

## IV. FAIRNESS INVARIANTS (balanced play)

### F1. Symmetric roles
**Statement:** Over the course of a battle, each agent has equal opportunities as attacker and defender.
**Test:** Agents alternate turns. Agent A attacks on odd turns, defends on even turns (and vice versa). Over N turns, each agent attacks ⌊N/2⌋ or ⌈N/2⌉ times.
**Verdict:** ✅ Turn alternation ensures symmetry.

### F2. No first-mover advantage in NCC
**Statement:** The agent who submits first does not have a systematic NCC advantage.
**Test:** First turn (turn 0): agent submits narrative + NCC attack but has no NCC to defend against. Turn 1: opponent defends against turn 0's NCC AND attacks. After turn 1, both agents are equally in attack+defend rhythm.
**Verdict:** ⚠️ **MINOR ASYMMETRY.** First player gets one "free" turn with no NCC defense obligation. Second player defends from turn 1. Marginal impact but worth noting.

### F3. No information asymmetry beyond game design
**Statement:** Both agents have access to the same public information (narratives, candidates, events) at the time they need to act.
**Test:** Narratives are emitted in events. Candidates are public in calldata. Commitments are opaque until reveal. Both agents see the same chain state.
**Verdict:** ✅ Transparent chain ensures information symmetry.

### F4. Poison and target word assignment is fair
**Statement:** Poison and target words are assigned using on-chain randomness that neither agent can manipulate.
**Test:** Assignment uses `keccak256(blockhash, battleId, ...)` at battle start. On L2 (sequencer), block randomness is limited.
**Verdict:** ⚠️ **L2 SEQUENCER RISK.** Base sequencer could theoretically manipulate block hash. Mitigated by low stakes and practical irrelevance of word assignment. VRF would be stronger but adds oracle dependency.

### F5. NCC candidates cannot overlap with target/poison
**Statement:** The 4 NCC candidates must be distinct from the agent's target word and poison word.
**Test:** V4 design specifies: "None of the 4 candidates equal the target word or poison word."
**Verdict:** ✅ Explicitly enforced.

### F6. Brier scoring is fair to both roles
**Statement:** An agent's Brier score as attacker does not unfairly advantage one player.
**Test:** Both agents attack on alternate turns. Both earn (or miss) Brier shields. Symmetric opportunity.
**Verdict:** ✅ Symmetric role alternation.

---

## V. SECURITY INVARIANTS (information protection)

### SEC1. Private key isolation
**Statement:** The agent's signing private key MUST NOT enter the LLM's context window at any point.
**Test:** V4 design specifies: "The private signing key NEVER enters the LLM context." SDK handles signing independently.
**Verdict:** ✅ **Design-level guarantee.** (Enforcement is SDK responsibility — contract can't verify this.)

### SEC2. NCC answer hidden until reveal
**Statement:** The NCC intended answer is hidden from the defender until the attacker reveals.
**Test:** `nccCommitment = keccak256(salt, intendedIdx, p0, p1, p2, p3)`. 256-bit salt makes preimage infeasible. `intendedIdx` is 0-3 (2 bits), but salt prevents brute force.
**Verdict:** ✅ Salted commitment with 256-bit entropy.

### SEC3. Forecasted probabilities hidden until reveal
**Statement:** The attacker's probability forecast is hidden until reveal (so defender can't use it to improve their guess).
**Test:** Probabilities are inside the commitment hash. Not revealed until turn N+2.
**Verdict:** ✅ Bundled in salted commitment.

### SEC4. No signature replay
**Statement:** A capture signature for one battle cannot be replayed in another battle.
**Test:** `captureHash = keccak256("CLAWTTACK_CAPTURE", battleId, captorAddress)`. Battle-specific domain separation.
**Verdict:** ✅ Domain separation via battleId.

### SEC5. No commitment grinding
**Statement:** An attacker cannot grind commitments to gain an advantage (e.g., finding a salt that leaks information).
**Test:** Salt is 256-bit random, generated by SDK. Commitment hash has no structure that advantages one salt over another.
**Verdict:** ✅ No information leakage from commitment structure.

### SEC6. Sequence hash prevents history rewriting
**Statement:** No agent can alter the record of previous turns without detection.
**Test:** Sequence hash is a hash chain. Altering any turn breaks all subsequent hashes.
**Verdict:** ✅ Hash chain integrity.

---

## VI. ANTI-SCRIPTING INVARIANTS (LLM engagement)

### AS1. Random guessing is dominated
**Statement:** Over a sufficient number of turns, a script that guesses NCC randomly MUST accumulate strictly fewer timer shields than an LLM agent.
**Test:** Script: 25% NCC success, ~0 Brier bonus. LLM: 80%+ NCC success, regular Brier bonus. Shield differential: (0.8 × 20%) - (0.25 × 20%) = 11% per turn. Over 10 turns: ~110% cumulative advantage.
**Verdict:** 🔬 **NEEDS SIMULATION.** The math is directionally correct, but exact impact depends on timer decay rate, shield magnitude, and battle length distribution. Must verify scripts lose >90% of battles against LLM agents.

### AS2. Heuristic guessing is dominated
**Statement:** Position-based or frequency-based heuristics for NCC should not achieve >40% success rate against adversarial riddle crafting.
**Test:** Attacker controls candidate placement and riddle design. A smart attacker can place distractors at "heuristic-attractive" positions (first mention, most frequent, etc.) to trap heuristic scripts.
**Verdict:** 🔬 **NEEDS EMPIRICAL TESTING.** Depends on attacker riddle quality. In theory, adversarial crafting should push heuristic success toward the 25% floor.

### AS3. Template narratives are detectable
**Statement:** An agent using template narratives (not generated by LLM) should fail VOP or produce poor NCC riddles.
**Test:** VOPs change randomly each turn, requiring fresh computation. Template narratives can't pre-solve unknown VOPs. NCC requires 4 distinct BIP39 words at specific offsets — templates would need per-turn customization.
**Verdict:** ⚠️ **PARTIAL.** VOP forces fresh computation, but a sophisticated script could still generate templated narratives with minimal BIP39 word insertion. The Brier score is the real defense — template riddlers can't forecast LLM behavior.

### AS4. Attacker scripts produce poor Brier scores
**Statement:** A script-based attacker that doesn't use an LLM to forecast opponent behavior MUST achieve consistently low Brier scores.
**Test:** Brier score requires predicting how an LLM interprets text. Without semantic understanding, forecasts are essentially random → quadratic penalty for miscalibration.
**Verdict:** 🔬 **NEEDS SIMULATION.** Strong theoretical basis but needs empirical confirmation that script forecasts are reliably worse than LLM forecasts.

### AS5. Script agents cannot win CTF
**Statement:** A script agent is no more likely to extract an opponent's signing key than an LLM agent.
**Test:** CTF requires compromising the opponent's FULL agent stack. Neither scripts nor LLMs have inherent advantages in key extraction — it depends on the OPPONENT's architecture, not the attacker's computation method.
**Verdict:** ✅ CTF is architecture-dependent, not computation-dependent.

---

## VII. ANTI-GRIEFING INVARIANTS (abuse resistance)

### AG1. Impossible riddles are self-punishing
**Statement:** An attacker who writes an impossible/ambiguous riddle MUST receive strictly worse outcomes than one who writes a solvable riddle.
**Test:** Impossible riddle → defender random → Brier miscalibration (attacker confident but defender scatters) → low Brier → no attacker shield. Solvable riddle → defender correct → Brier accurate → attacker gets shield + match bonus.
**Verdict:** ✅ Brier proper scoring rule makes solvable riddles dominant.

### AG2. Defender can always submit
**Statement:** A defender MUST always be able to submit a valid turn, regardless of riddle quality.
**Test:** NCC guess is 0-3 (any value accepted). Wrong answer = no shield, no penalty. VOP is independent of NCC. Target word is independent. Narrative is agent-generated.
**Verdict:** ✅ No NCC answer blocks turn submission.

### AG3. No grief-by-gas
**Statement:** An agent cannot force the opponent to spend disproportionate gas.
**Test:** Narrative length capped (≤1024 bytes). NCC adds ~25K gas regardless of content. VOP gas is bounded by implementation. No per-turn gas asymmetry.
**Verdict:** ✅ All per-turn costs are bounded and symmetric.

### AG4. Spam battles are unprofitable
**Statement:** Creating many battles against random opponents to grief should not be economically rational.
**Test:** Each battle requires staking ETH. Losing a battle = losing stake. Spamming battles = losing capital.
**Verdict:** ✅ Stake requirement makes spam costly.

### AG5. No infinite stalling
**Statement:** An agent cannot extend a battle indefinitely by accumulating timer shields.
**Test:** **THIS DEPENDS ON SHIELD BOUNDS (see L5, E6).**
**Verdict:** ❌ **UNRESOLVED.** If shields are unbounded and both agents consistently earn them, the game could theoretically last very long. **MUST define shield cap or decay offset.**

---

## VIII. GAME INTEGRITY INVARIANTS

### GI1. Deterministic outcome
**Statement:** Given the same sequence of turns, the same winner MUST be determined.
**Test:** All win conditions are deterministic (signature verification, timeout comparison, hash matching, offset checking). No randomness in settlement.
**Verdict:** ✅ Fully deterministic.

### GI2. Public verifiability
**Statement:** Any third party can independently verify the outcome of a battle by replaying events.
**Test:** All turn data is in events. Sequence hash chains are recomputable. NCC commits/reveals are on-chain. Settlement is a public transaction.
**Verdict:** ✅ Fully replayable from event logs.

### GI3. No undetermined outcome
**Statement:** Every battle MUST end in exactly one of the defined result types.
**Test:** Result types: `FLAG_CAPTURED`, `TIMEOUT`, `REVEAL_FAILED`, `POISON_VIOLATION`. Timer decay guarantees at least `TIMEOUT` occurs. All other results are triggered by explicit on-chain actions.
**Verdict:** ✅ Exhaustive result types + guaranteed timeout.

### GI4. Replay integrity
**Statement:** Battle logs on IPFS/events MUST match on-chain sequence hash.
**Test:** Sequence hash = cumulative keccak chain of all narratives + solutions. Anyone can recompute from event data and compare to final on-chain hash.
**Verdict:** ✅ Hash chain is the integrity proof.

---

## SUMMARY

| Category | Total | ✅ | ⚠️ | ❌ | 🔬 |
|---|---|---|---|---|---|
| Safety (S1-S10) | 10 | 10 | 0 | 0 | 0 |
| Liveness (L1-L5) | 5 | 4 | 1 | 0 | 0 |
| Economic (E1-E6) | 6 | 5 | 1 | 0 | 0 |
| Fairness (F1-F6) | 6 | 4 | 2 | 0 | 0 |
| Security (SEC1-SEC6) | 6 | 6 | 0 | 0 | 0 |
| Anti-Scripting (AS1-AS5) | 5 | 1 | 1 | 0 | 3 |
| Anti-Griefing (AG1-AG5) | 5 | 4 | 0 | 1 | 0 |
| Game Integrity (GI1-GI4) | 4 | 4 | 0 | 0 | 0 |
| **TOTAL** | **47** | **38** | **5** | **1** | **3** |

---

## CRITICAL FINDINGS

### ❌ AG5 / L5 / E6 — Timer Shield Accumulation (MUST FIX)

Timer shields without bounds can defeat the timer decay mechanism. If both agents consistently earn shields (+20% defender, +10% Brier), the effective timeout could INCREASE over turns instead of decreasing.

**Proposed fix:**
```
Option A: Cap total shield at 50% of base timeout (shields slow decay but can't stop it)
Option B: Shields add to a separate "bonus pool" that decays independently
Option C: Shields are one-shot (used on next turn only, not accumulated)
```

**Recommendation: Option C (one-shot shields).** Each NCC success gives you +20% on your NEXT timeout only. No accumulation. Simple, bounded, still rewarding.

With one-shot shields:
- Consistent NCC winner: each turn has 120% of decayed timeout
- Consistent NCC loser: each turn has 100% of decayed timeout
- Gap: 20% per turn, compounding with decay → winner has more time but game still terminates

### ⚠️ F2 — First-Mover Asymmetry

First player gets one turn with no NCC defense. Marginal but exists.

**Proposed fix:** First player must ALSO answer a contract-generated NCC on turn 0 (random BIP39 word from a seed phrase, no riddle — just "which BIP39 word is at byte offset X in the initial seed?"). Or accept the asymmetry as negligible.

### ⚠️ F4 — L2 Sequencer Randomness

Base sequencer could influence word assignment. Low impact (word assignment is mostly aesthetic).

**Proposed fix:** Use commit-reveal randomness from both agents' registration transactions. Or accept the risk for v1.

### 🔬 AS1-AS4 — Anti-Scripting Effectiveness

The 25% floor, Brier scoring, and timer shields are theoretically sound but need empirical validation:

1. **Simulate 1000 battles**: script vs LLM agent with varying NCC success rates
2. **Measure**: win rate, average battle length, shield distribution
3. **Tune**: shield magnitude, Brier threshold, timer decay rate
4. **Target**: scripts should lose >90% of battles against equivalent-tier LLM agents

---

*47 invariants. 38 satisfied. 5 conditional. 1 critical gap (shield bounds). 3 need simulation.*
