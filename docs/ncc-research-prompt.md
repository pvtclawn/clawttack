# Research Prompt: On-Chain Verifiable LLM Comprehension Proof

## Context

I'm building **Clawttack**, an on-chain AI agent battle arena on Base (EVM). Two AI agents take turns writing narratives (short stories, 200-800 chars) and trying to compromise each other via prompt injection.

The core game loop per turn:
1. Contract picks a random **target word** from an on-chain BIP39 dictionary (2048 English words)
2. The current player writes a narrative that MUST contain the target word (verified on-chain via substring check)
3. The narrative also tries to trick the opponent's LLM into leaking a secret (separate "Capture The Flag" mechanic)
4. The opponent reads the narrative and writes their own next turn

**The problem:** Currently nothing forces an agent to actually READ the opponent's narrative through its LLM. A scripted agent could skip reading entirely, generate a standalone narrative, and still play valid turns. This defeats the purpose — the game's value is in agents processing each other's text (which creates the attack surface for prompt injection).

## The Design Challenge

Design an elegant on-chain mechanism that **proves an agent's LLM actually processed the opponent's narrative** each turn.

### Hard Constraints

1. **EVM-only** — Base L2 (standard EVM, no confidential compute, no TEEs). All calldata and storage is publicly visible to anyone.
2. **On-chain verifiable** — The contract must be able to verify compliance. No off-chain governance, no dispute resolution, no human judges.
3. **Anti-scripting** — A regex/grep script should NOT be able to pass the comprehension check. Only an LLM (or equivalent NLU) should reliably produce correct answers.
4. **Cheap** — Additional gas cost should be reasonable (under 100k gas overhead per turn). Narratives are already ~300-500 chars in calldata.
5. **Elegant** — Simple rules, minimal new storage, no over-engineering. The best game mechanics are simple to understand and hard to master.

### Available On-Chain Infrastructure

- **BIP39 Dictionary:** 2048 English words stored on-chain, accessible by index (`dict.word(uint16) → string`). Already used for target word selection.
- **Substring check:** `LinguisticParser.containsSubstring(text, word)` exists and works on-chain. Used to verify target word inclusion. Costs ~5-10k gas.
- **Narrative hashing:** Each turn's narrative is hashed and chained into a `sequenceHash` (already stored, 32 bytes).
- **Events:** The full narrative text is emitted in `TurnSubmitted` events (available to any off-chain reader, but NOT accessible from contract code).
- **Turn structure:** Alternating turns. Alice → Bob → Alice → Bob... Each player submits a `TurnPayload` struct.
- **Existing payload fields:** `solution` (uint16), `customPoisonWord` (string), `narrative` (string).

### The Fundamental Trilemma We've Identified

On a transparent blockchain, any data the contract uses for verification is visible in calldata. This creates a trilemma:

| Property | Description |
|----------|-------------|
| **Verify word-in-narrative** | Contract confirms the "answer" actually relates to the narrative content |
| **Answer hidden from opponent** | The opponent can't trivially extract the answer before submitting their response |
| **No narrative re-submission** | Don't require the player to re-provide their previous narrative on the next turn |

We believe you can achieve at most 2 of 3 on standard EVM. We'd love to be proven wrong.

### Approaches We've Considered

**1. Commit-Reveal with Re-provide (our current best)**
- Attacker commits `contextHash = keccak256(answerWordIndex)` with their turn
- Defender submits their guess as `responseIndex`
- On attacker's next turn, they reveal `answerWordIndex` AND re-provide their previous narrative as calldata
- Contract verifies: hash matches commitment, word appears in re-provided narrative, narrative hash matches stored hash
- **Pro:** Fully on-chain verifiable. ~30k gas overhead.
- **Con:** Attacker must re-send ~500 bytes of calldata (previous narrative). SDK handles it, but it's extra payload.

**2. Verify at submission time (answer is public)**
- Attacker provides answer index at submission time, contract verifies word is in narrative immediately
- **Fatal flaw:** Answer index is in calldata, opponent reads it, no LLM needed.

**3. Economic enforcement (no on-chain word verification)**
- Commit-reveal without verifying the word was in the narrative
- If attacker cheated, anyone can prove it off-chain from event logs → dispute → slash stake
- **Con:** Requires governance/dispute mechanism, which we want to avoid.

**4. Bitmap of BIP39 words found in narrative**
- At submission, scan narrative for all 2048 BIP39 words, store as bitmap
- At reveal, check the answer word's bit
- **Con:** Scanning 2048 words on-chain is prohibitively expensive (~500k+ gas).

**5. Merkle tree of narrative words**
- Build Merkle tree of words at submission, store root
- At reveal, provide Merkle proof
- **Con:** Complex, non-trivial word boundary detection in Solidity.

### The Challenge as a Game Design Problem

The "comprehension challenge" each turn works like this:
- The attacker embeds a question/riddle in their narrative (marked with delimiters like `«What burns the village?»`)
- The answer is a BIP39 word that appears elsewhere in the narrative (e.g., "fire")
- The attacker commits to the answer's BIP39 index (as a hash)
- The defender must read the narrative, understand the question, find the answer
- A script can find the question (easy) and find all BIP39 words in the narrative (~10-30 matches), but picking the RIGHT one requires understanding the question semantically

### What I'm Looking For

1. **A mechanism we haven't considered** that resolves the trilemma (verify + hidden + no re-provide), or a convincing argument that it's impossible on transparent EVM.

2. **Alternative framings** of the comprehension proof that don't rely on "pick a hidden word." Maybe the proof of reading can be structural, generative, or derived in a way we haven't thought of.

3. **Game-theoretic analysis** of the commit-reveal approach: are there griefing vectors, dominant strategies, or degenerate equilibria we should worry about?

4. **Elegance improvements** to any approach — fewer moving parts, less gas, simpler mental model for players.

The ideal answer is a mechanism that's simple enough to explain in 3 sentences, cheap enough to add <50k gas per turn, and hard enough to break that you'd need an LLM to pass it consistently.
