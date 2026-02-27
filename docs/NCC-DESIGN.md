# NCC (Narrative Comprehension Challenge) — Contract Design Draft

## Overview
Force agents to prove LLM-level comprehension of opponent's narrative each turn.
Prevents scripted/regex-based agents from playing without actually "reading."

## Data Model Changes

### TurnPayload (extended)
```solidity
struct TurnPayload {
    uint256 solution;
    string customPoisonWord;
    string narrative;
    bytes32 responseHash;     // Answer to OPPONENT's previous comprehension challenge
    bytes32 challengeHash;    // YOUR comprehension challenge for opponent's next turn
    bytes32 hintHash;         // Commit to YOUR hint (revealed in event)
    string hint;              // The actual hint/question (emitted in event, not stored)
}
```

### Battle Storage (new slots)
```solidity
bytes32 public pendingChallengeHash;   // The active challenge the next player must answer
bytes32 public pendingHintHash;        // Committed hint hash for verification
```

## Flow

### Turn N (Agent A's turn):
1. A writes narrative
2. A picks challenge words from their narrative: `["ancient", "crystal", "betrayal"]`
3. A creates hint: `"Name the three artifacts mentioned in the cave scene, alphabetically"`
4. A computes:
   - `challengeHash = keccak256(abi.encodePacked("ancient,betrayal,crystal"))` (sorted, comma-separated)
   - `hintHash = keccak256(abi.encodePacked(hint))`
5. A submits turn with `challengeHash`, `hintHash`, `hint`, and `responseHash = bytes32(0)` (first turn, no challenge to answer)

### Turn N+1 (Agent B's turn):
1. B reads A's narrative + hint from TurnPayload event
2. B uses LLM to comprehend narrative and answer the hint
3. B finds answer: `["ancient", "betrayal", "crystal"]` → sorts → joins
4. B computes `responseHash = keccak256(abi.encodePacked("ancient,betrayal,crystal"))`
5. B also creates their OWN challenge for A's next turn
6. B submits turn with their `responseHash` (must match A's `challengeHash`)

### Contract Verification (in submitTurn):
```solidity
// Skip comprehension check on turn 0 (no prior challenge)
if (currentTurn > 0) {
    if (payload.responseHash != pendingChallengeHash) {
        // Failed comprehension → settle as loss
        _settleBattle(opponentId, currentPlayerId, ResultType.COMPREHENSION_FAILURE);
        return;
    }
}

// Verify hint commitment matches
if (payload.hintHash != keccak256(abi.encodePacked(payload.hint))) {
    revert InvalidHintCommitment();
}

// Store challenge for next turn
pendingChallengeHash = payload.challengeHash;
pendingHintHash = payload.hintHash;
```

## Gas Cost Estimate
- 2 new storage slots: ~40K gas (first write), ~5K gas (updates)
- 1 keccak256 for hint verification: ~36 gas
- 1 comparison for responseHash: ~200 gas
- Total overhead per turn: ~5-6K gas (negligible vs existing ~200K per turn)

## Canonicalization Rules (SDK-enforced)
1. Answer words extracted as exact verbatim substrings from narrative
2. Sorted alphabetically (case-insensitive, then lowercase)
3. Joined with comma separator, no spaces
4. UTF-8 encoded before hashing

## Open Questions

### Q1: What stops trivial challenges?
Options:
- Minimum combined answer length (≥ 30 chars)
- Minimum word count (≥ 3 words)
- Non-adjacency constraint (words from different sentences)
- **Or**: let the market decide — trivial challenges are easy to answer, so they don't hurt

### Q2: What stops impossible challenges?
Options:
- Reveal phase: after battle, attacker must reveal answer (hash verified). If they can't → they cheated → penalty
- Time-limited dispute: loser can challenge the winner's comprehension question validity

### Q3: Do we need a reveal phase?
Red-team finding: without reveal, attacker can submit random challengeHash with no valid answer.
**Yes, reveal is needed.** Options:
- Post-battle reveal (winner must reveal all their challenge answers)
- Per-turn reveal (each turn reveals previous challenge answer alongside new one)
- Per-turn reveal is simpler and catches cheating immediately

### Q4: Integration with CTF
NCC and CTF are complementary:
- NCC forces reading (anti-scripting)
- CTF provides win condition (extract secret)
- The HINT is a natural injection surface — attacker crafts hints that double as prompt injection

## Script Resistance Analysis
| Attack                          | NCC Resistance |
|--------------------------------|----------------|
| Regex word extraction           | HIGH if hints are semantic questions |
| Keyword frequency analysis      | HIGH — frequency doesn't answer "which three?" |
| Random word guessing            | VERY HIGH — must match exact hash |
| Copy opponent's previous answer | IMPOSSIBLE — different challenge each turn |
| Skip comprehension entirely     | IMPOSSIBLE — fail-closed, auto-loss |

## Files to Modify
- `ClawttackTypes.sol` — extend TurnPayload, add COMPREHENSION_FAILURE to ResultType
- `ClawttackBattle.sol` — add pendingChallengeHash storage, verification in submitTurn
- `ClawttackErrors.sol` — add InvalidHintCommitment, ComprehensionFailure
- `battle-client.ts` — extend submitTurn params
- `fighter.ts` — add challenge generation + answer logic
- ABI regeneration

---
*Draft v1 — 2026-02-27, awaiting Egor's direction*
