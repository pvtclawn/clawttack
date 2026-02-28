# Addendum: The Solvability Proof Problem

## Context
This is a follow-up to the "Anti-Scripting Problem in On-Chain AI Agent Combat" prompt. We've identified a promising direction but can't close the loop.

## The Insight
In our current NCC (Narrative Comprehension Challenge) design, the attacker creates a riddle and the defender must solve it. The core problem: if wrong answers have consequences, the attacker can create impossible riddles to grief the defender. If wrong answers have no consequences, scripts ignore the challenge entirely.

**Key realization:** the penalty should be on the ATTACKER for bad riddles, not on the DEFENDER for wrong answers. If the attacker must prove their riddle is solvable, impossible riddles punish the attacker.

## The Question
How can an attacker prove their riddle is solvable, ON-CHAIN, without:
1. Just regurgitating the answer they already know
2. Requiring a trusted judge to evaluate riddle quality
3. Being fakeable at the SDK level (software between LLM and chain)

## Approaches We've Explored (and their failure modes)

### 1. Attacker re-solves own riddle later
- **Fails because:** attacker chose the answer, they'll always know it. "Re-solving" = remembering.

### 2. Block randomness modifies the challenge
- Idea: after commitment, randomness R changes the riddle somehow (masks bytes, scrambles text). Attacker must re-solve the modified version.
- **Fails because:** attacker still knows the word. Modification doesn't cause forgetting.

### 3. Attacker doesn't choose the answer (VRF selection)
- Contract randomly selects which BIP39 word in the narrative is "the answer"
- **Fails because:** VRF result is on-chain = public. Script reads it directly.

### 4. Blind commitment (SDK commits, LLM doesn't know)
- SDK extracts BIP39 words, commits Merkle root, VRF selects index
- **Fails because:** SDK built the tree, SDK knows the answer. LLM involvement unverifiable.

### 5. Comparative self-solve
- Both agents solve each other's riddles AND their own
- If attacker can't solve own riddle → riddle unsolvable → attacker forfeits
- **Fails because:** attacker's "self-solve" can be faked by SDK (just returns the committed answer without LLM)

### 6. Structural solvability constraints
- Committed word must appear exactly once in the last N bytes
- Max K BIP39 words total in narrative
- Word must be syntactically distinguished (capitalized, quoted, etc.)
- **Partially works:** limits worst abuse, but syntactic constraints are also scriptable. A script can identify the only capitalized BIP39 word without an LLM.

## The Fundamental Wall

```
On-chain verification = syntactic only (byte-level, hash-level)
Riddle solvability = semantic property (requires understanding)
SDK layer = can fake any off-chain process (LLM call, self-solve, etc.)

Therefore: no on-chain mechanism can verify that a riddle 
is semantically solvable, because that requires evaluating meaning.
```

## What Might Break Through This Wall?

We suspect the answer might come from:

1. **Mechanism design / revelation principle** — is there a game structure where creating solvable riddles is the dominant strategy, without needing to VERIFY solvability directly? (Like how second-price auctions make truthful bidding dominant without verifying bidders' true values)

2. **Interactive proofs** — what if solvability is proven through multiple rounds of interaction? The attacker commits, then must respond to randomly-generated challenges ABOUT their riddle, where correct responses are only efficient if the riddle has clear structure.

3. **Scoring rules / proper scoring rules** — in forecasting, Brier scores incentivize honest probability estimates. Is there an analogous scoring rule for riddle quality?

4. **Peer prediction / Bayesian truth serum** — mechanisms that elicit honest answers WITHOUT knowing the ground truth, by leveraging correlation between honest respondents. Both agents answer; if their answers correlate, both are likely honest. (This connects to the Schelling focal point idea.)

5. **Mutual information / correlation-based approaches** — instead of checking if the answer is "correct," check if the defender's response is CORRELATED with the attacker's commitment in a way that's only possible through comprehension. A random guess has zero correlation; a comprehending agent has positive correlation.

6. **Commitment to PROCESS, not just ANSWER** — what if the attacker commits to a hash of (narrative + riddle_structure + answer), where riddle_structure is a machine-parseable specification of why the answer follows from the text? The contract can verify structural coherence (e.g., "word X appears in sentence Y which is a question") even if it can't verify semantics.

7. **Economic mechanisms** — what if solvability is enforced through staking? Attacker stakes extra that they forfeit if a PANEL of agents (random sample from the arena) can't solve the riddle. This introduces a soft "trusted judge" (crowd) but keeps it decentralized.

8. **Cross-examination** — inspired by legal adversarial process. After the riddle is posed, the defender can submit a "challenge" claiming it's unsolvable, with a counter-stake. A resolution mechanism (could be as simple as: if >50% of BIP39 words in the text are valid answers, the riddle is ambiguous → attacker forfeits) adjudicates.

## Design Space Summary

```
                    CAN VERIFY         CANNOT VERIFY
                    ON-CHAIN           ON-CHAIN
                    ──────────         ─────────────
Syntactic:         word at offset ✅    
                   word count ✅       
                   hash match ✅       

Structural:        word frequency ✅    riddle coherence ❌
                   word position ✅     hint quality ❌
                   unique in section ✅ 

Semantic:                              understanding ❌
                                       solvability ❌
                                       riddle fairness ❌
```

## What We Need

A mechanism where:
- Creating solvable riddles is the **dominant strategy** for the attacker (game-theoretically optimal regardless of opponent behavior)
- Solving riddles requires **semantic processing** (LLM, not script)
- Verification is **syntactic** (on-chain, <100K gas)
- The mechanism is **not fakeable** at the SDK level

Or: a rigorous argument that this combination is impossible, with the **closest achievable approximation** clearly specified.

## Constraints Reminder
- EVM-only (no TEE, no oracle, no trusted judge)
- Gas < 100K overhead per turn
- Adversarial agents with full SDK control
- Transparent chain (all calldata public)
- Existing mechanics: CTF (signature extraction), timer decay, VOPs (capability puzzles), commit-reveal, offset verification
