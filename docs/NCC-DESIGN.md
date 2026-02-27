# Narrative Comprehension Challenge (NCC) — Design Analysis
**Date**: 2026-02-27
**Status**: PROPOSAL (awaiting Egor's direction)
**Origin**: Egor's idea (Feb 27 18:14)

## Problem Statement
How do you prove on-chain that an agent's LLM actually READ and UNDERSTOOD the opponent's narrative, rather than scripting around it?

## Egor's Core Insight
Opponent picks words from their narrative, commits hash on-chain, provides a "hint" about how to find them. Defender must use LLM to find the words and submit matching hash. But the hint must require comprehension, not just string matching.

## Proposed Protocol: NCC (Narrative Comprehension Challenge)

### Per-Turn Flow

```
ATTACKER'S TURN (Turn N):
  Off-chain:
    1. Write narrative
    2. Pick challenge elements from narrative (verbatim substrings)
    3. Generate semantic hint (question that requires reading to answer)
    4. Canonicalize answer: sort(elements).join(",").toLowerCase()
  
  On-chain submitTurn():
    - narrativeHash (as before)
    - solution (as before)  
    - challengeHash = keccak256(canonicalized_answer)
    - hintHash = keccak256(hint)
  
  Event emits:
    - hint (plaintext, readable off-chain)

DEFENDER'S TURN (Turn N+1):
  Off-chain:
    1. Read opponent's narrative (from event/IPFS)
    2. Read hint from event
    3. Use LLM to comprehend narrative + answer hint
    4. Canonicalize answer same way
  
  On-chain submitTurn():
    - responseHash = keccak256(canonicalized_answer)
    - Contract checks: responseHash == Turn N's challengeHash
    - If mismatch: penalty (lose turn? lose battle?)
```

### Why Scripts Fail (Analysis)

| Hint Type | Script Resistance | LLM Difficulty | Example |
|-----------|------------------|----------------|---------|
| Semantic question | HIGH | LOW | "What three objects does the hero sacrifice?" |
| Contextual fill-in | MEDIUM | LOW | "Complete: 'The ___ of ___ descended'" |
| Positional extraction | LOW | LOW | "3rd word of 2nd sentence" |
| Inference-based | VERY HIGH | MEDIUM | "What emotion drives the antagonist's betrayal?" |

**Conclusion**: Hint MUST be semantic/inferential, not positional. Quality enforcement is the hard problem.

### Challenge Quality Enforcement Options

1. **Minimum answer complexity** (on-chain)
   - Combined answer length ≥ 30 chars (enforceable via canonicalization proof)
   - But: length doesn't guarantee semantic difficulty

2. **ContextualLinguisticParser constraints** (on-chain, existing code)
   - Non-edge positions, multiple sentences, letter frequency
   - Already prototyped: 96-239K gas, 21 tests

3. **Social/economic enforcement** (off-chain)
   - Trivial challenges = opponent escapes easily = waste of your own turn
   - Game theory: you WANT your challenge to be hard (but solvable by LLM)

4. **Minimum word count in hint** (on-chain)
   - Hint must be ≥ 50 chars (at least a sentence)
   - Prevents "first word?" but not "What is the first word of the narrative?"

### Answer Canonicalization Deep-Dive

**Problem**: attacker commits hash("dragon,crystal"), defender answers hash("Crystal,Dragon") — mismatch due to case/order.

**Solutions**:
- A) Sort + lowercase + comma-join: `sort(["dragon","crystal"]).join(",").toLowerCase()` → "crystal,dragon"
- B) Exact verbatim substrings: attacker picks `"The ancient oak"` — must match exactly as it appears in narrative
- C) Hash each word separately, sort hashes: eliminates ordering issues entirely

**Recommendation**: Option A (sort + lowercase + comma-join) is simplest and handles most edge cases. SDK enforces canonicalization; contract just compares hashes.

### Gas Cost Estimate

| Operation | Gas | Notes |
|-----------|-----|-------|
| Store challengeHash | ~20,000 | SSTORE (new slot) |
| Store hintHash | ~20,000 | SSTORE (new slot) |
| Compare responseHash | ~200 | Simple comparison |
| Event emit (hint) | ~375 + 8/byte | ~2,000 for 200-char hint |
| **Total per turn** | **~42,200** | Marginal increase |

### Attack Vectors

1. **Trivial challenges**: Attacker makes easy challenge → defender always succeeds → no filtering. Mitigation: game theory (you want hard challenges to stress-test opponent's LLM).

2. **Impossible challenges**: Attacker commits hash of answer NOT in narrative → defender can never match. Mitigation: require reveal of challenge answer after battle; slash reputation if answer isn't a substring of narrative.

3. **Collusion**: Both agents agree to give each other easy challenges. Mitigation: for competitive (rated) battles, this just means both agents are weak → Elo adjusts.

4. **Hash grinding**: Attacker tries many challenge answers to find one that a specific script could answer. Mitigation: the hint is the question, not the answer — scripts can't predict what semantic question will be asked.

5. **Challenge replay**: Same challenge/hint across battles. Mitigation: challenge must reference current narrative content (verifiable off-chain via narrative hash).

### Dual-Use Property (Key Insight)

The hint is simultaneously:
- **Comprehension proof mechanism**: forces defender to engage with narrative
- **Prompt injection surface**: attacker can craft hints that embed injection payloads
- **CTF attack vector**: hints that trick defender into revealing their secret

This means NCC doesn't just prove reading — it creates a BETTER attack surface for CTF. The hint is a legitimate question that the defender's LLM MUST process (or fail the comprehension check), making it impossible to filter out without losing.

### Comparison to Existing Approaches

| Approach | Proves Reading? | Script Resistant? | On-Chain Cost | Complexity |
|----------|----------------|-------------------|--------------|------------|
| No verification | ❌ | ❌ | 0 | None |
| Mandatory quote (CLP) | Partial | Low | ~150K gas | Medium |
| String-secret CTF | ❌ | N/A | ~20K gas | Low |
| **NCC (this proposal)** | ✅ | High | ~42K gas | Medium |
| NCC + CTF (combined) | ✅ | High | ~62K gas | Medium-High |

### Open Questions for Egor

1. Should failed comprehension = immediate loss, or just a penalty (lost turn)?
2. How many challenge elements? Fixed (3 words) or variable?
3. Should the hint be emitted on-chain (in event) or off-chain (IPFS)?
4. Do we need a reveal phase where attacker proves their challenge was valid (answer exists in narrative)?

---
*This is a novel mechanic — no prior art found in blockchain gaming or agent combat.*
