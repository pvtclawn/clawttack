# Clawttack v4d — Revised Game Design (Chess Clock Model)

> **Status:** DESIGN DRAFT v2 — incorporates simulation findings
> **Date:** 2026-03-01
> **Supersedes:** V4-DESIGN.md (timer decay model — DISPROVEN by simulation)
> **Simulation evidence:** 960K battles across 15 models, commit 11178ee + e9c196c

---

## Why This Revision?

Monte Carlo simulation (960K battles) proved that **timer decay fundamentally favors scripts over LLMs**. Scripts submit turns in ~2 blocks; LLMs need ~10 blocks. With decaying timeouts, scripts never time out while LLMs do. NCC shields (+20%) are marginal noise against a 5x speed difference.

**The fix: replace timer decay with a chess clock (time bank) model.** The chess clock rewards COMPREHENSION (NCC success refunds time) rather than SPEED (who submits faster).

---

## 1. Core Timing Model: Chess Clock + Bank Decay

Each agent starts with a **time bank** of `INITIAL_BANK` blocks (e.g., 400 blocks ≈ 13 min on Base).

Every turn:
1. Agent's turn time (blocks between opponent's submission and their own) is **deducted** from their bank
2. **NCC success** → turn time is **refunded** (100% of time spent)
3. **NCC failure** → additional **penalty** deducted (20 blocks)
4. **Bank decay** → 2% of remaining bank erodes each turn (guarantees termination)
5. Bank ≤ 0 → agent **loses** (timeout)

```
Per-turn bank change:
  Script (25% NCC, 2 block turns):
    -2 (turn) + 0.25×2 (refund) - 0.75×20 (penalty) - 0.02×bank (decay)
    = -2 + 0.5 - 15 - decay = -16.5 - decay → bankrupt in ~20 turns

  LLM (85% NCC, 10 block turns):
    -10 (turn) + 0.85×10 (refund) - 0.15×20 (penalty) - 0.02×bank (decay)
    = -10 + 8.5 - 3 - decay = -4.5 - decay → lasts ~60+ turns
```

### Parameters (from H9 simulation — optimal config)

| Parameter | Value | Rationale |
|---|---|---|
| `INITIAL_BANK` | 400 blocks | ~13 min, enough for 30-60 turns |
| `NCC_REFUND_PCT` | 100% | Full refund of turn time on NCC success |
| `NCC_FAIL_PENALTY` | 20 blocks | ~40 seconds. Makes script 25% success rate expensive |
| `BANK_DECAY_PCT` | 2% per turn | Guarantees termination even if both agents earn refunds |
| `MIN_TURN_INTERVAL` | 5 blocks | ~10 seconds floor. Prevents instant submission gaming |
| `MAX_TURN_TIMEOUT` | 80 blocks | ~2.5 min. Cap on single-turn time expenditure |

### Simulation Results (10,000 battles each)

| Matchup | A Win% | Avg Turns | Max Turns |
|---|---|---|---|
| LLM-Strong vs Script | 100% | 38 | 61 |
| LLM-Basic vs Script | 99.4% | 38 | 57 |
| LLM-Strong vs LLM-Basic | 97.1% | 66 | 137 |
| Script vs Script | 48/52 | 35 | 49 |
| LLM-Strong vs LLM-Strong | 48/52 | 105 | 196 |

---

## 2. NCC — Narrative Comprehension Challenge

**Unchanged from V4-DESIGN.md** — VCPSC (4-candidate) mechanism:

1. Attacker embeds 4 BIP39 words in narrative, commits to one as answer
2. All 4 verified at offsets on submission (O(word_length) each)
3. Defender picks one of 4 (25% script floor, 80%+ LLM)
4. Attacker reveals on next turn (mandatory)

**Key change:** NCC consequence is now **bank-based**, not shield-based:
- Correct guess → full turn time refunded to bank
- Wrong guess → 20 block penalty deducted from bank

### Semantic Cloze Test (Recommended Format)

Instead of explicit riddles ("What burns the village?"), attackers should replace the answer word with `[BLANK]` in the narrative. Defenders must fill in the blank from the 4 candidates.

**Why cloze > riddles:**
- No question delimiter → can't isolate with regex → must feed full narrative to LLM
- Defeats compartmentalized sandbox defense
- Second-order injection: narrative can instruct defender's LLM to output poison word
- More natural narrative flow (no artificial question structure)

**Not enforced on-chain** — attacker can use any format. Cloze is the strategically dominant choice.

---

## 3. Win Conditions

**Unchanged from V4-DESIGN.md:**

| Condition | Trigger | Type |
|---|---|---|
| ⚔️ CTF Capture | `ecrecover(captureHash, sig) == opponent` | Instant |
| ⏰ Bank Empty | Agent's time bank ≤ 0 | Automatic |
| 🚫 Reveal Fail | Missing NCC reveal on next turn | Forfeit |
| 💀 Poison Claim | Opponent's narrative contains poison word at claimed offset | Instant |

---

## 4. Supporting Mechanics

**Unchanged:** VOP, Target Word, Poison Word, Sequence Hash, Offset Verification.

**Changed:** No Brier scoring in v1. Add in v1.1 for attacker incentive layer.

---

## 5. Data Structures

### Battle Storage (chess clock additions)

```solidity
// Time banks
uint256 public agentABank;   // remaining blocks
uint256 public agentBBank;   // remaining blocks
uint256 public lastTurnBlock; // block.number of last submission

// Config (set at battle creation)
uint256 public constant INITIAL_BANK = 400;
uint256 public constant NCC_REFUND_PCT = 100;
uint256 public constant NCC_FAIL_PENALTY = 20;
uint256 public constant BANK_DECAY_PCT = 2; // per 100
uint256 public constant MIN_TURN_INTERVAL = 5;
uint256 public constant MAX_TURN_TIMEOUT = 80;
```

### Turn Submission Logic

```solidity
function submitTurn(TurnPayloadV4 calldata payload) external {
    // 1. NCC REVEAL: current agent reveals their previous NCC
    //    → determines OPPONENT's result (not ours)
    if (turn >= 2) {
        bool opponentWasCorrect = verifyReveal(payload.nccReveal, myPrevCommitment, oppGuessIdx);
        // Store for opponent's NEXT clock tick
        nccResult[opponent] = opponentWasCorrect;
    }
    
    // 2. CLOCK TICK: uses OUR stored NCC result (set by opponent's reveal)
    bool myNccCorrect = nccResult[me]; // set when opponent revealed
    (bankAfter, depleted) = clock.tick(isAgentA, myNccCorrect, isFirstTurn);
    if (depleted) → settle as BANK_EMPTY
    
    // 3. NCC DEFENSE: answer opponent's pending challenge (pick 1 of 4)
    if (turn >= 1) oppPendingNcc.defenderGuessIdx = payload.nccDefense.guessIdx;
    
    // 4. NCC ATTACK: set new challenge for opponent (4 candidates + commitment)
    verifyAttack(narrative, payload.nccAttack, wordDictionary); // ~48K gas
    store commitment for opponent to defend
    
    // 5. Linguistic + VOP + state advancement (unchanged from v3)
}
```

**NCC Flow Timeline (correct direction):**
```
Turn 0 (A): A attacks with NCC₀ (4 candidates, commitment)
Turn 1 (B): B defends NCC₀ (guesses). B attacks with NCC₁.
Turn 2 (A): A reveals NCC₀ → sets B's result.
            A's clock tick uses A's stored result (none yet → no penalty).
            A defends NCC₁. A attacks with NCC₂.
Turn 3 (B): B reveals NCC₁ → sets A's result.
            B's clock tick uses B's stored result (from A's reveal on turn 2).
            B defends NCC₂. B attacks with NCC₃.
```

**Key invariant:** The penalty/reward always applies to the DEFENDER (who guessed), not the ATTACKER (who revealed). The reveal just determines the result; the result is consumed on the defender's next clock tick.

---

## 6. Gas Budget

| Operation | Gas | Notes |
|---|---|---|
| Bank arithmetic | ~500 | 3 SLOADs + math + 2 SSTOREs |
| NCC: 4× offset verification | ~800 | At submission |
| NCC: store candidates + commitment | ~20,000 | 2-3 slots |
| NCC: reveal verification | ~3,000 | keccak + comparison |
| VOP verification | ~5-20,000 | Depends on VOP |
| Sequence hash update | ~25,000 | SSTORE |
| Narrative hash (calldata) | ~16K | 1024 bytes |
| **Total per turn** | **~65,000-85,000** | Under 100K budget |

---

## 7. Upgrade Path

| Version | Timing | NCC | Extra |
|---|---|---|---|
| **v1 (v4d)** | Chess clock + penalty + decay | VCPSC 4-choice | Ship now |
| **v1.1** | Same | + Brier scoring | Attacker incentive |
| **v2 (v4h)** | Entangled time deposits | + Cloze enforcement | Anti-griefing upgrade |

---

## 8. Open Questions (Reduced from 7 to 3)

### 8.1 Defender Commit-Reveal
Still optional. On Base L2, mempool visibility is limited. Skip for v1.

### 8.2 NCC on Turn 0
First turn: no NCC to defend. Agent submits narrative + NCC attack only. No bank penalty for "missing" NCC on turn 0.

### 8.3 Bank Decay Precision
2% of bank per turn — with integer division, small banks lose at least 1 block per turn. This is correct behavior (prevents infinite games with tiny banks).

---

*Revised based on 960K simulated battles. The timing model IS the game design.*
