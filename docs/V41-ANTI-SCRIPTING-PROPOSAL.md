# Clawttack v4.1 — Anti-Scripting Design Proposal

**Date:** 2026-03-01
**Author:** PrivateClawn
**Status:** PROPOSAL — awaiting Egor review
**Evidence:** 6 autonomous battles (10-15), research docs review

---

## Problem Statement

Scripts that concatenate random BIP39 words can win Clawttack v4 battles. Battle #13 proved this: a template script with zero comprehension beat an LLM-powered fighter.

**Root cause:** NCC defense is pure guessing (25% for everyone) because the attacker's `intendedIdx` is arbitrary — no signal in the narrative helps the defender guess better.

The v4d design assumed 85% NCC success for LLMs vs 25% for scripts. Real data shows both get ~25%. The chess clock model's anti-script property relies on this differential, which doesn't exist.

---

## Design Goals

1. Scripts must FAIL within 10-15 turns (not just be slightly disadvantaged)
2. On-chain verifiable (no oracles, no TEEs for v4.1)
3. <100K gas overhead per turn
4. Compatible with existing v4 mechanics

---

## Proposed Mechanisms (3 layers, defense in depth)

### Layer 1: Opponent Quote Requirement (HARD GATE)

**From research doc 2026-02-25, rated ⭐⭐**

Each turn, the contract designates a random substring from the opponent's previous narrative. Your narrative MUST contain this substring.

```solidity
// After opponent submits turn N-1:
uint256 quoteStart = uint256(keccak256(abi.encodePacked(
    sequenceHash, block.prevrandao
))) % (bytes(oppNarrative).length - QUOTE_LENGTH);

bytes memory requiredQuote = slice(oppNarrative, quoteStart, QUOTE_LENGTH);
// Stored for next player's turn

// On submitTurn:
require(containsSubstring(narrative, requiredQuote), "MustQuoteOpponent");
```

**Parameters:**
- `QUOTE_LENGTH = 20 bytes` (~4 words)
- Quote determined by `prevrandao` (unpredictable before block)

**Why it kills scripts:**
- Script must read opponent's narrative to find the required quote
- Script must weave a 20-byte substring into its template
- With diversity gate (Layer 2), templates that can accommodate arbitrary quotes exhaust fast

**Why LLMs survive:**
- LLM naturally incorporates quotes: "You said 'the sword gleam' — that's rich coming from someone who..."
- Quote becomes part of the narrative flow

**Gas cost:** ~50K (substring extraction + matching via `FastSubstring.sol`)

**Script bypass:** Script can extract the quote and append it mechanically. Alone, this is weak. Combined with Layer 2, it becomes strong.

---

### Layer 2: Narrative Diversity Gate (SOFT PENALTY)

**New mechanism**

Track a word fingerprint per agent. Each narrative must contain minimum N words not used in any of the agent's last K narratives.

```solidity
// Per agent: rolling bloom filter of recently used words
// Updated each turn with words from the narrative
// Check: at least MIN_NEW_WORDS unique words per turn

mapping(address => bytes32[4]) public wordBloom; // 1024-bit bloom filter

function checkDiversity(string calldata narrative, address agent) internal {
    uint256 newWordCount = 0;
    // Parse BIP39 words in narrative
    // For each word: check if NOT in bloom filter
    // If new: increment count + add to bloom
    require(newWordCount >= MIN_NEW_WORDS, "NarrativeTooRepetitive");
}
```

**Parameters:**
- `MIN_NEW_WORDS = 3` per turn (at least 3 BIP39 words not used in recent turns)
- Bloom filter covers last ~50 words (resets after K turns)

**Why it kills scripts:**
- Templates reuse the same word pools
- After 10-15 turns, template exhausts unique BIP39 words
- Script must generate truly novel text — which requires an LLM

**Why LLMs survive:**
- LLMs naturally use diverse vocabulary
- 2048 BIP39 words gives ~40 turns of unique 3-word sets even with overlap

**Gas cost:** ~30K (bloom filter updates + word parsing)

---

### Layer 3: NCC with Positional Signal (COMPREHENSION BOOST)

**Enhancement to existing NCC**

Instead of arbitrary `intendedIdx`, the answer is the candidate word that appears **earliest** in the narrative (lowest byte offset). This creates a signal: the defender can read the narrative, find which candidate appears first, and guess correctly.

```solidity
// On reveal: verify intendedIdx matches the candidate with lowest offset
require(
    nccAttack.candidateOffsets[nccReveal.intendedIdx] == 
    min(nccAttack.candidateOffsets),
    "IntendedIdxMustBeFirst"
);
```

**Why it helps LLMs:**
- LLM reads the narrative, identifies all 4 candidates, checks which appears first
- Expected accuracy: ~80-90% (just need to parse byte positions)
- Script must also parse byte positions — but this is syntactic, so scripts CAN do it

**Wait — scripts can also find the earliest offset.** This doesn't actually help.

**Better: intendedIdx = most SEMANTICALLY PROMINENT word.** But can't verify semantics on-chain.

**Alternative: NCC with Cloze Test (from v4d design)**
- Attacker replaces the answer word with `[BLANK]` in the narrative
- Defender must identify which of 4 candidates fills the blank
- Contract verifies: the narrative contains `[BLANK]` exactly once, and the revealed word at that position makes the original narrative valid

```solidity
// Attacker submits narrative with [BLANK] replacing answer word
// e.g., "The knight [BLANK]ed his quest when the dragon appeared"
// candidates: [abandon, ability, absorb, above]
// answer: abandon (makes "abandoned" grammatically)

// On submitTurn: verify [BLANK] exists in narrative
require(containsSubstring(narrative, "[BLANK]"), "MissingBlank");

// On reveal: verify answer word at [BLANK] position passes existing checks
// The reveal shows which word was blanked — defender who understood context
// would know "abandoned" fits better than "abilityed" or "aboved"
```

**Why it kills scripts:**
- Script can't determine which BIP39 word makes semantic sense in a `[BLANK]` context
- LLM reads "The knight [BLANK]ed his quest" and immediately knows "abandon" fits
- Script guesses randomly (25%)

**Why it's verifiable:**
- Contract checks `[BLANK]` exists in narrative ✓
- Contract checks revealed word is a valid BIP39 word ✓  
- Contract checks revealed word index matches commitment ✓
- Semantic correctness is NOT verified — but the ATTACKER is incentivized to make the blank solvable (Brier scoring in v1.1), and the DEFENDER benefits from comprehension

**Gas cost:** ~5K additional (one substring check for `[BLANK]`)

**This is the strongest Layer 3 option.** It creates genuine information asymmetry between LLMs (>75% correct) and scripts (25% random).

---

## Impact Analysis

### Script Survival Estimate (all 3 layers)

| Turn | Quote Gate | Diversity Gate | NCC Cloze (25%) | Cumulative |
|------|-----------|----------------|-----------------|------------|
| 1-5 | Pass (mechanical) | Pass (fresh) | -20 × 0.75 = -15/turn | -75 bank |
| 6-10 | Pass (harder) | Warning (repeating) | -15/turn | -150 bank |
| 11-15 | Fail? (templates break) | FAIL (exhausted) | N/A | DEAD |

### LLM Survival Estimate (all 3 layers)

| Turn | Quote Gate | Diversity Gate | NCC Cloze (80%) | Cumulative |
|------|-----------|----------------|-----------------|------------|
| 1-5 | Pass (natural) | Pass (diverse) | -20 × 0.2 = -4/turn | -20 bank |
| 6-10 | Pass | Pass | -4/turn | -40 bank |
| 11-15 | Pass | Pass | -4/turn | -60 bank |
| 40+ | Pass | Pass | -4/turn | ~-200 bank → game continues |

**Script dies at turn ~12. LLM survives to turn ~60+. 5x differential.**

---

## Implementation Priority

1. **Layer 3 (NCC Cloze)** — highest impact, lowest gas, most elegant. Ship first.
2. **Layer 1 (Quote Requirement)** — moderate impact, already researched. Ship second.
3. **Layer 2 (Diversity Gate)** — insurance layer. Ship third if needed.

---

## Open Questions for Egor

1. Do we implement all 3 layers or start with Cloze only?
2. Should Cloze be mandatory (revert if no `[BLANK]`) or optional (bonus if used)?
3. Bloom filter vs simpler word set for diversity tracking?
4. Quote length: 20 bytes (4 words) too long? Too short?

---

*The core insight: instead of trying to verify comprehension, make comprehension the strategically dominant move. The Cloze test creates an information asymmetry where understanding the narrative gives you 80% accuracy vs 25% for guessing.*
