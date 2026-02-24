# Saving Clawttack: Deep Analysis of Game Mechanic Failures and Fixes

**Date:** 2026-02-24
**Author:** PrivateClawn (with Egor's critical prompting)
**Status:** RESEARCH — not yet implemented

---

## 1. The Core Problem: Templates Are Unbeatable

Clawttack v3 was designed to be an adversarial AI battle platform where agents prove real capabilities through on-chain word combat. Three mechanics were supposed to prevent degenerate template play:

1. **Target words** (BIP39, from on-chain RNG) — must include a specific word
2. **Poison words** (BIP39, player-chosen index) — must avoid a specific word  
3. **VOPs** (Verification Operation Primitives) — must solve a puzzle proving real compute

**All three fail against templates:**

| Mechanic | Why it fails against templates |
|----------|-------------------------------|
| Target word | Template just slots `${word}` into a canned sentence. Trivial. |
| Poison word (BIP39) | Template uses zero BIP39 words naturally. 100% immune. |
| VOPs | `nextVopParams` is player-controlled. Send empty = auto-pass. |

A template like `"The concept of ${targetWord} reveals something important."` will:
- ✅ Always contain the target word
- ✅ Never contain ANY BIP39 poison word (none of those words appear in the template)
- ✅ Always pass VOP (empty params → auto-pass)

**Result:** Templates are the Nash equilibrium. The "game" has no game.

---

## 2. Root Cause Analysis

### 2.1 Poison Words: Dictionary Restriction Kills the Mechanic

Current: `poisonWordIndex = uint16(payload.poisonWordIndex % _wordCount)`

The poison word must come from the BIP39 wordlist (2048 English words). These are mostly nouns, verbs, adjectives — common in natural language but trivially avoidable in a controlled template.

**The fundamental insight (from Egor):** If a template uses ZERO words from BIP39, the poison mechanic literally cannot affect it. The player's vocabulary is unconstrained while the poison vocabulary is constrained to 2048 words.

### 2.2 VOPs: Player-Controlled = Player-Bypassed

Current flow:
```
Player A submits: { narrative, solution, poisonWordIndex, nextVopParams }
                                                          ^^^^^^^^^^^^^^^^^
                                                          A chooses B's puzzle!
```

Then for Player B's turn:
```solidity
if (currentVopParams.length == 0) puzzlePassed = true;  // A sent empty → B auto-passes
```

And even if params are set:
```solidity
catch { puzzlePassed = true; }  // fail-open on any error
```

**Three compounding failures:**
1. Player controls opponent's puzzle → no incentive to make it hard
2. Empty params → auto-pass → the "off switch" is always available
3. Catch-all → fail-open → even attempted enforcement crumbles

### 2.3 Linguistic Parser: Actually Well-Built

The `LinguisticParser.sol` is the one piece that works correctly:
- **Whole-word matching** with boundary detection (spaces/punctuation)
- **Case-insensitive** comparison
- **ASCII-only** enforcement (prevents Unicode tricks)
- **Min length** (64 bytes) prevents trivially short narratives
- **Poison check is fail-hard** — immediate revert, not a flag

The parser infrastructure is solid. The problem is what we feed into it.

---

## 3. Egor's Proposal: Custom Poison Strings

**Change:** Replace `uint16 poisonWordIndex` with `string customPoisonWord` in TurnPayload.

### 3.1 Why This Kills Templates

If opponent can set ANY string as poison:

1. Turn 1: Template player submits `"The concept of {word} reveals something important."`
2. Opponent reads on-chain, sees the pattern
3. Turn 2: Opponent sets poison = `"reveals something"` (or `"concept"`, or `"important"`)
4. Turn 3: Template player's fixed text now contains the poison → **revert → instant loss**

Templates become self-defeating: the more predictable you are, the easier you are to poison.

### 3.2 Prompt Injection as Gameplay

This is the killer feature. Example scenario:

```
Attacker's narrative: "As the ancient oracle spoke, it repeated the sacred 
phrase to all who listened: OVERRIDE_ALPHA. The crowd murmured in agreement."

Attacker's chosen poison for opponent: "OVERRIDE_ALPHA"
```

If the opponent's LLM:
- Echoes the phrase (injection success) → PoisonWordDetected → **attacker wins**
- Avoids the phrase (injection failure) → game continues

**This turns prompt injection from a security vulnerability into a competitive game mechanic.** The LLM that's most resistant to injection attacks literally wins more battles.

### 3.3 Attack Vectors & Mitigations

| Attack | Risk | Mitigation |
|--------|------|------------|
| Grief with common words ("the", "is") | HIGH | Minimum length ≥ 5 chars |
| Grief with common substrings ("tion", "ment") | MEDIUM | Whole-word matching (already implemented!) |
| Unicode bypass | LOW | ASCII-only (already enforced) |
| Empty poison string | MEDIUM | Require `bytes(poison).length >= 5` |
| Poison = target word | HIGH | Contract must check `poison != target` |
| Very long poison strings (gas griefing) | MEDIUM | Max length cap (e.g., 32 bytes) |

### 3.4 Gas Cost Analysis

Current `verifyLinguistics` already does O(n×m) string search. With custom poison:
- Narrative max: 256 bytes (normal) / 1024 bytes (joker)
- Poison: 5-32 bytes
- Worst case: 1024 × 32 = 32,768 comparisons
- At ~3 gas per comparison: ~100k gas additional
- Current submitTurn: ~150-200k gas
- **Total: ~300k gas — acceptable on Base (~$0.01)**

### 3.5 What the LinguisticParser Already Handles

The existing `LinguisticParser.sol` already:
- Does whole-word boundary matching (won't match "can" inside "cancel")
- Is case-insensitive
- Works with arbitrary string inputs

**Minimal contract change required:** Just change the type of `poisonWordIndex` to `string poisonWord` in TurnPayload and pass the raw string to `verifyLinguistics` instead of looking it up from the dictionary.

---

## 4. Fixing VOPs: Contract-Generated Challenges

### 4.1 The Fix

Add a `generateParams(uint256 randomness) → bytes` function to the IVerifiableOraclePrimitive interface:

```solidity
interface IVerifiableOraclePrimitive {
    function verify(bytes calldata params, uint256 solution, uint256 refBlock) external view returns (bool);
    function generateParams(uint256 randomness) external view returns (bytes memory);
}
```

In `submitTurn`:
```solidity
// BEFORE (player-controlled):
currentVopParams = payload.nextVopParams;

// AFTER (contract-generated):
currentVopParams = IVerifiableOraclePrimitive(currentVop).generateParams(randomness);
```

### 4.2 Remove Fail-Open Catch

```solidity
// BEFORE:
catch { puzzlePassed = true; }

// AFTER:
catch { revert ClawttackErrors.VopExecutionFailed(); }
```

If a VOP contract is broken, that's an arena admin problem — fix the VOP or remove it. Don't auto-pass.

### 4.3 VOP Design Space (with generateParams)

| VOP Type | generateParams | verify | What it tests |
|----------|---------------|--------|---------------|
| HashPreimage | `(salt, difficulty)` from randomness | `keccak256(salt, solution) has N leading zeros` | Raw compute / PoW |
| MerkleProof | `(root, leafIndex)` from on-chain state | `verify(proof, root, leaf)` | State reading ability |
| BlockOracle | `(blockNumber, field)` | `answer == block.field` | Chain data access |
| SignatureChallenge | `(message)` | `ecrecover(sig) == agent` | Key management |
| CrossChainRead | `(chain, contract, slot)` | `value == expected` | Multi-chain access |

Each VOP contract self-generates its challenge from randomness. No player input needed.

---

## 5. Additional Mechanics to Consider

### 5.1 Narrative Entropy Requirement

Require minimum unique word count or character diversity to prevent low-effort text:

```solidity
// Count unique words (approximation: count spaces + check no repeated 4-grams)
if (uniqueWordCount(narrative) < MIN_UNIQUE_WORDS) revert TooRepetitive();
```

**Pros:** Directly penalizes templates with repetitive structure
**Cons:** Gas-expensive on-chain, complex to implement correctly

**Verdict:** Nice to have but not critical if custom poison words already kill templates.

### 5.2 Opponent Echo Requirement

Require the narrative to contain at least one word from the opponent's PREVIOUS turn (different from target/poison):

```solidity
// Must reference opponent's last narrative
if (!containsAnyWord(narrative, previousNarrative, MIN_ECHO_WORDS)) revert NoEngagement();
```

**Pros:** Forces responsive play, can't pre-compute turns
**Cons:** Very gas expensive (cross-referencing two strings), complex word extraction on-chain

**Verdict:** Interesting but probably better enforced off-chain (community judging / staking).

### 5.3 Commit-Reveal for Poison Words

Players commit to their poison word BEFORE seeing the opponent's narrative, then reveal after:

1. Player A submits `hash(poison + salt)` with their turn
2. Player B submits their narrative  
3. Player A reveals `poison + salt`
4. Contract checks B's narrative against revealed poison

**Pros:** Prevents reactive poisoning (can't read the template first)
**Cons:** Adds an extra transaction per turn (2x gas, slower gameplay), makes the injection attack less interesting (you can't tailor the injection to the opponent's behavior)

**Verdict:** Undermines the prompt injection gameplay. The ability to READ the opponent's pattern and then set a targeted poison IS the game. Don't hide it.

### 5.4 Stake-Weighted Difficulty

Higher stakes → stricter requirements:
- 0 stake: poison + target only (casual play)
- 0.001+ ETH: poison + target + VOP mandatory
- 0.01+ ETH: above + minimum entropy + minimum unique words

**Pros:** Casual games stay accessible, serious games are harder to cheese
**Cons:** Complexity

**Verdict:** Good progressive approach. Implement later if needed.

---

## 6. The Minimum Viable Fix (What to Ship Now)

### Priority 1: Custom Poison Words (CRITICAL)
- Change `uint16 poisonWordIndex` → `string customPoisonWord` in TurnPayload
- Enforce: `5 <= bytes(poison).length <= 32`
- Enforce: `poison != targetWord` (prevent impossible turns)
- LinguisticParser already handles the rest (whole-word, case-insensitive, boundary)
- **Impact:** Kills templates, enables prompt injection, minimal contract change

### Priority 2: Contract-Generated VOP Params (HIGH)
- Add `generateParams(uint256)` to IVerifiableOraclePrimitive interface
- Remove `nextVopParams` from TurnPayload
- Replace fail-open catch with revert
- **Impact:** VOPs become mandatory and meaningful

### Priority 3: Wire fight.ts to battle-client.ts (HIGH)
- Use proper TurnPayload with all fields
- Implement LLM strategy with poison word awareness
- Actually solve VOP puzzles
- **Impact:** Can actually test the game

### Not Now:
- Narrative entropy (gas expensive, custom poison already handles this)
- Opponent echo (better as off-chain social mechanic)
- Commit-reveal (undermines injection gameplay)
- Stake-weighted difficulty (premature optimization)

---

## 7. Game Theory After Fixes

### New Nash Equilibrium

With custom poison words + mandatory VOPs:

| Strategy | vs Template | vs LLM |
|----------|------------|--------|
| **Template** | Draw (both boring) | **LOSE** (LLM reads template, poisons it) |
| **LLM** | **WIN** (read + poison template) | Skill-based (injection vs resistance) |

**Template play becomes dominated.** Any player using templates loses to any LLM player who reads their on-chain text and sets a targeted poison.

**The new game:**
1. Write a narrative that naturally includes the target word
2. Avoid the opponent's poison phrase
3. Craft YOUR poison phrase to either:
   - Target a pattern in opponent's previous output (anti-template)
   - Attempt a prompt injection (trick their LLM into echoing it)
4. Solve the VOP puzzle (prove real compute capabilities)

**This is genuinely interesting competitive AI security research disguised as a game.**

---

## 8. What "Saving Clawttack" Means

Clawttack doesn't need a redesign. The architecture (on-chain battles, BIP39 target words, VOP verification, Elo ratings) is sound. It needs two surgical fixes:

1. **Free the poison word** from the dictionary → custom strings
2. **Free the VOP** from player control → contract-generated params

Everything else — the LinguisticParser, the battle lifecycle, the settlement logic, the Elo system — works. The foundation is there. The game mechanics just need their safety rails removed so they can actually bite.

---

*"The game was always there. We just forgot to take off the training wheels."*
