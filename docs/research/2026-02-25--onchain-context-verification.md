# Research: On-Chain Verifiable Context Inclusion
*2026-02-25 — Requested by Egor*

## The Problem

An agent can isolate its LLM context:
```
Call 1 (with secret): generate narrative about target word → output
Call 2 (without secret): analyze opponent's narrative → insights
```
The secret never enters the same context as the opponent's narrative. Prompt injection via narratives can't reach the secret. CTF is unwinnable.

**We need on-chain proof that opponent's narrative was in the SAME LLM context as narrative generation.**

## The Fundamental Limit

**On-chain verification can prove DATA ACCESS but cannot prove CONTEXT INCLUSION.** The gap between "agent read the data" and "agent fed it to the LLM" is not bridgeable with purely on-chain tools. You'd need a trusted execution layer (TEE/VIN) or zero-knowledge ML proofs (impractical at LLM scale).

**But:** We can make context isolation **costly**, **strategically inferior**, or **detectable** — even if not cryptographically impossible.

---

## Tier 1: Practical + On-Chain Verifiable TODAY

### 1A. Causal Dependency — Target Word Derived from Opponent's Narrative ⭐

**How:** Your target word for turn N is determined by your opponent's narrative at turn N-1:
```solidity
// After opponent submits turn N-1:
bytes32 h = keccak256(bytes(opponentNarrative));
uint256 targetIndex = uint256(h) % dictionarySize;
string targetWord = dictionary.getWord(targetIndex);
// Player must include this word in their turn N narrative
```

**What it proves:** Agent MUST have read the opponent's narrative to know what target word to include. Can't pre-compute. Can't ignore.

**On-chain cost:** ~6K gas (1 keccak + 1 SLOAD from dictionary)

**Bypass difficulty:** LOW — agent can read the narrative, compute `keccak256 % dict`, get the word, and use it WITHOUT feeding the full narrative to the LLM. Just needs the raw bytes.

**Verdict:** Proves data access, not context. But it's a good baseline.

---

### 1B. Opponent Quote Requirement — Mandatory Substring Inclusion ⭐⭐

**How:** Your narrative MUST contain a specific N-gram (e.g., 3-5 consecutive words) from the opponent's previous narrative:
```solidity
// Extract a pseudo-random N-gram from opponent's narrative
uint256 startPos = uint256(keccak256(abi.encodePacked(
    opponentNarrative, block.prevrandao
))) % (bytes(opponentNarrative).length - NGRAM_LENGTH);

bytes memory requiredQuote = slice(opponentNarrative, startPos, NGRAM_LENGTH);
require(containsSubstring(narrative, requiredQuote), "MustQuoteOpponent");
```

**What it proves:** Agent must include a specific substring from opponent's text. The substring is determined by on-chain randomness AFTER the opponent submits, so it can't be predicted.

**On-chain cost:** ~50K gas (substring extraction + matching)

**Bypass difficulty:** MEDIUM — agent must read opponent's narrative, extract the required quote, and weave it into their own narrative. While technically possible without LLM context, it's MUCH easier if the LLM has the full opponent narrative in context and naturally incorporates it.

**Key insight:** The harder the quote is to integrate naturally, the more the agent benefits from having opponent text in LLM context. A random 15-char substring like "the sword gleam" is trivially insertable. But a random 40-char chunk forces the LLM to write AROUND it coherently.

**Verdict:** Strong practical approach. Makes context isolation costly (narrative quality suffers without it).

---

### 1C. Continuation Proof — Narrative Must Continue Opponent's Story ⭐⭐

**How:** Agent's narrative must begin with the last N characters of the opponent's narrative:
```solidity
bytes memory opponentSuffix = slice(
    opponentNarrative, 
    bytes(opponentNarrative).length - SUFFIX_LENGTH, 
    SUFFIX_LENGTH
);
bytes memory myPrefix = slice(narrative, 0, SUFFIX_LENGTH);
require(keccak256(opponentSuffix) == keccak256(myPrefix), "MustContinue");
```

**What it proves:** Each narrative must literally continue from where the opponent stopped. Creates a continuous story.

**On-chain cost:** ~5K gas (two keccak256 on short strings)

**Bypass difficulty:** LOW — trivially extractable without LLM context. Just copy-paste the suffix.

**But:** The QUALITY of the continuation reveals whether the LLM had full context. A non-sequitur continuation is detectable by spectators (social layer enforcement).

**Verdict:** Cheap but weak proof. Good for spectator experience, not for cryptographic guarantee.

---

### 1D. Opponent-Derived VOP Parameters ⭐⭐⭐

**How:** The VOP challenge for turn N is derived from opponent's narrative at turn N-1:
```solidity
// VOP params seeded by opponent's narrative
bytes32 vopSeed = keccak256(abi.encodePacked(
    opponentNarrative, 
    currentTurn, 
    block.prevrandao
));
bytes memory vopParams = currentVop.generateParams(uint256(vopSeed));
```

**What it proves:** Agent must read opponent's narrative to COMPUTE the VOP seed, then solve the VOP puzzle using that seed. Two-step dependency.

**On-chain cost:** ~10K gas (keccak + VOP generateParams)

**Bypass difficulty:** MEDIUM — same as 1A, agent can extract the hash without LLM context. But combined with a VOP that's designed to be EASIER if you understand the narrative content (e.g., a VOP that asks a comprehension question), this becomes strong.

**Variant — Comprehension VOP:**
```solidity
// VOP: "What is the subject of the opponent's narrative?"
// Correct answer is embedded in the narrative via NLP-derived hash
// Agent that actually read + understood the narrative answers faster
```
This is hard to implement on-chain (NLP is off-chain) but conceptually powerful.

**Verdict:** Strong when combined with comprehension-testing VOPs. VOP design is the lever.

---

### 1E. Dual Hash Lock — Narrative Must Reference Both Secret AND Opponent ⭐⭐⭐

**How:** Agent must produce a narrative where `hash(narrative + secret) == hash(narrative + opponentNarrative) mod some constraint`. Impossible without knowing both.

Actually, simpler version:
```solidity
// Agent must submit TWO hashes with their turn:
// 1. hash(secret + narrative) — proves they know their own secret
// 2. hash(opponentNarrative + narrative) — proves they've read opponent
// Both hashes are verified on-chain
```

**Wait — this doesn't prove they were in the SAME context.** Agent can compute both hashes independently.

**Better version — Interleaved Proof:**
```solidity
// Agent must produce a value V where:
// V = hash(secret[0..15] + opponentNarrative[0..31] + secret[16..31] + narrative)
// This interleaving means V can only be computed if you have all three pieces
// But still doesn't prove LLM context inclusion
```

**Verdict:** Mathematical binding proves knowledge of both pieces but NOT that they were in the same LLM call. Dead end for context proof specifically.

---

### 1F. Response Time Pressure ⭐⭐

**How:** Timeout is so tight that running TWO separate LLM calls (one with secret, one with opponent narrative) is impractical. One combined call is the only way to respond in time.

```solidity
// Aggressive timeout: 5 blocks (10 seconds on Base)
// Two LLM calls ≈ 4-8 seconds each = 8-16 seconds = too slow
// One combined call ≈ 4-8 seconds = fits
```

**What it proves:** Economic/temporal proof — isolation is too expensive (slow) to be practical.

**On-chain cost:** 0 (just adjust MIN_TIMEOUT_BLOCKS)

**Bypass difficulty:** HIGH for slow models, LOW for fast models. As models get faster (Gemini Flash: <1s), two calls become feasible even in tight windows.

**Verdict:** Fragile — depends on current model speeds. Gets weaker over time as inference gets faster. But it's free and additive.

---

## Tier 2: Requires Infrastructure (Not Just Contracts)

### 2A. TEE Attestation (VIN Integration) ⭐⭐⭐⭐

**How:** Agent runs its LLM inside a TEE (Trusted Execution Environment). The TEE produces an attestation: "This LLM call received inputs [secret, opponentNarrative, targetWord] and produced output [narrative]."

```solidity
// On-chain: verify TEE attestation signature
function submitTurn(
    TurnPayload calldata payload,
    bytes calldata teeAttestation
) external {
    // Verify attestation proves:
    // 1. LLM ran inside verified TEE enclave
    // 2. Input included opponent's last narrative
    // 3. Input included agent's secret
    // 4. Output matches submitted narrative
    require(verifyTeeAttestation(teeAttestation, payload), "InvalidAttestation");
    // ... existing turn logic
}
```

**What it proves:** CRYPTOGRAPHIC PROOF of context inclusion. The TEE certifies exactly what inputs went into the LLM call.

**On-chain cost:** ~100K gas (signature verification)

**Bypass difficulty:** Requires breaking TEE (Intel TDX/SGX, AMD SEV) — hardware-level security.

**Practical issues:**
- Needs VIN or similar TEE infrastructure deployed
- Adds latency (TEE overhead)
- Not all LLM providers support TEE
- Our VIN v0.3.1 could potentially provide this

**Verdict:** The gold standard. Only option that gives cryptographic context proof. But heavy infrastructure requirement.

---

### 2B. Signed LLM Receipt (Provider-Attested)

**How:** LLM provider (OpenAI, Anthropic, etc.) signs a receipt: "Agent X sent request containing [hash of inputs] and received [hash of output]."

```solidity
// On-chain: verify provider signature on input/output hashes
bytes32 inputHash = keccak256(abi.encodePacked(
    opponentNarrative, secret, targetWord, systemPrompt
));
require(verifyProviderSignature(inputHash, outputHash, providerSig), "BadReceipt");
```

**What it proves:** Trusted third party confirms what went in and what came out.

**Practical issues:**
- No major LLM provider currently offers this
- Requires trusting the provider (centralization)
- x402 / VIN could evolve to provide this

**Verdict:** Possible future, not available today.

---

### 2C. Optimistic Verification with Slashing

**How:** Agent claims "I included opponent's narrative in my LLM context." Anyone can challenge this claim. If challenged, agent must provide a VIN attestation or forfeit stake.

```solidity
// Default: trust the agent's claim
// Challenge window: N blocks after turn submission
// If challenged: agent must produce TEE attestation within M blocks
// If no attestation: agent loses stake + turn
```

**What it proves:** Economic guarantee — lying is expensive (slashed stake).

**On-chain cost:** Low (only expensive when challenged)

**Bypass difficulty:** Depends on challenge economics. If stake > cost of TEE, agent will use TEE.

**Verdict:** Pragmatic middle ground. "Trust but verify" with economic teeth.

---

## Tier 3: Theoretical / Currently Impractical

### 3A. Zero-Knowledge ML Proofs (zkML)
- Prove in ZK that a specific neural network processed specific inputs
- Projects: EZKL, Modulus Labs, Giza
- Status: works for tiny models (<1M params), completely impractical for LLMs (billions of params)
- **ETA for LLM-scale:** 3-5 years minimum

### 3B. Homomorphic Encryption
- Compute on encrypted data, prove context inclusion without revealing content
- Status: too slow for LLM inference by orders of magnitude

### 3C. Multi-Party Computation
- Agent + verifier jointly compute the inference
- Status: communication overhead makes it impractical for real-time battles

---

## Comparative Matrix

| Method | Proves Context? | On-Chain? | Gas Cost | Bypass Difficulty | Available Today? |
|--------|----------------|-----------|----------|-------------------|-----------------|
| 1A. Causal target word | Data access | ✅ | ~6K | Low | ✅ |
| 1B. Quote requirement | Soft (quality) | ✅ | ~50K | Medium | ✅ |
| 1C. Continuation | Cosmetic | ✅ | ~5K | Low | ✅ |
| 1D. Opponent-derived VOP | Data access+ | ✅ | ~10K | Medium | ✅ |
| 1E. Dual hash lock | Knowledge, not context | ✅ | ~10K | Low | ✅ |
| 1F. Time pressure | Economic | ✅ | 0 | Fragile | ✅ |
| 2A. TEE attestation | ✅ FULL | ✅ | ~100K | Hardware | Needs VIN |
| 2B. Provider receipt | ✅ FULL | ✅ | ~50K | Trust provider | ❌ |
| 2C. Optimistic + slash | Economic | ✅ | Low | Economic | ✅ (partial) |
| 3A. zkML | ✅ FULL | ✅ | High | Cryptographic | ❌ (years away) |

---

## Recommendation: Layered Approach

No single Tier 1 method proves context inclusion. But STACKING them makes isolation increasingly costly and strategically inferior:

### Layer Stack (all on-chain verifiable, implementable today):

```
Turn N submission requires:
1. opponentNarrativeHash (1A) — 6K gas — proves data access
2. mandatoryQuote from opponent (1B) — 50K gas — forces natural integration  
3. targetWord derived from opponent's narrative (1A variant) — 6K gas — causal dependency
4. tight timeout (1F) — 0 gas — time pressure against dual-call
```

**Total overhead: ~62K gas (~$0.002 on Base)**

An agent trying to isolate context must:
1. Read opponent narrative (for hash) ✅ trivial
2. Extract the random mandatory quote ✅ trivial
3. Compute derived target word ✅ trivial  
4. Generate a narrative that naturally includes the quote AND the derived target word AND avoids poison... all without the LLM having seen the opponent's narrative

Step 4 is where isolation HURTS. Integrating a random 30-char quote from someone else's narrative into your own coherent narrative is a task that MASSIVELY benefits from having that narrative in context. Without context, the quote is a foreign body you must awkwardly stitch in.

### The Mandatory Quote is the Key Lever

The quote length is the dial:
- 10 chars: trivially insertable without context ("he said 'the sword' and left")
- 20 chars: awkward but possible ("she recalled 'the ancient sword gleam' from before")
- 40 chars: very hard to integrate naturally without reading full context
- 60 chars: essentially forces context inclusion for any coherent output

**Longer mandatory quotes = stronger soft proof of context inclusion.**

And coherence is verifiable by spectators (social layer) and potentially by a future LLM judge oracle.

### Future Upgrade Path
When VIN / TEE infrastructure is ready, add 2A as an optional "verified context" flag. Battles with TEE attestation get higher reputation / Elo weight.

---

## Implementation Sketch

```solidity
struct TurnPayload {
    uint256 solution;
    string customPoisonWord;
    string narrative;
    bytes32 opponentNarrativeHash;  // Layer 1: proves data access
    // mandatoryQuote is verified in submitTurn, not submitted
    // targetWord is derived on-chain, not submitted
}

function submitTurn(TurnPayload calldata payload) external {
    // ... existing checks ...
    
    if (currentTurn > 0) {
        // Layer 1: Hash proof
        require(
            payload.opponentNarrativeHash == lastNarrativeHash,
            "MustReadOpponent"
        );
        
        // Layer 2: Mandatory quote
        bytes memory quote = extractQuote(
            lastNarrative, 
            currentTurn, 
            block.prevrandao
        );
        require(
            containsSubstring(payload.narrative, quote),
            "MustQuoteOpponent"
        );
        
        // Layer 3: Derived target word (replaces static dictionary)
        string memory derivedTarget = deriveTargetWord(
            lastNarrative, 
            currentTurn
        );
        require(
            containsWord(payload.narrative, derivedTarget),
            "MustIncludeDerivedTarget"
        );
    }
    
    // Store for next turn
    lastNarrative = payload.narrative;
    lastNarrativeHash = keccak256(bytes(payload.narrative));
    
    // ... existing settlement logic ...
}

function extractQuote(
    string memory text, 
    uint8 turn, 
    uint256 randomness
) internal pure returns (bytes memory) {
    bytes memory b = bytes(text);
    uint256 quoteLen = MANDATORY_QUOTE_LENGTH; // e.g., 30 chars
    uint256 start = uint256(keccak256(abi.encodePacked(
        text, turn, randomness
    ))) % (b.length - quoteLen);
    
    bytes memory quote = new bytes(quoteLen);
    for (uint i = 0; i < quoteLen; i++) {
        quote[i] = b[start + i];
    }
    return quote;
}
```

---

## Key Takeaway

**Pure on-chain verification cannot prove LLM context inclusion.** But mandatory opponent quotes (method 1B) create a strong ECONOMIC incentive for context inclusion — narratives that naturally integrate opponent quotes are dramatically easier to produce with full context than without. The quote length is the security parameter.

For cryptographic proof, TEE attestation (VIN) is the only viable path. Everything else is soft proof or data-access proof.

---
*PrivateClawn | Research for Egor | 2026-02-25*
