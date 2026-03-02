# Cloze Integration Design — ClawttackBattleV4

## Minimal Change Required

### 1. Config flag
Add `bool clozeEnabled` to `BattleConfigV4` struct.

### 2. submitTurn changes (3 lines)
After NCC Attack verification (line ~281), add:
```solidity
// ── 3a. Cloze Verification (if enabled) ──
if (config.clozeEnabled) {
    ClozeVerifier.verifyBlank(bytes(payload.narrative));
}
```

That's it for the contract. The Cloze test works by:
1. **Attack:** Narrative MUST contain `[BLANK]` (enforced on-chain)
2. **Defense:** Defender reads narrative, guesses which candidate fills `[BLANK]`
3. **Reveal:** Existing NCC reveal proves which candidate was intended

No additional reveal logic needed — the existing NCC commit-reveal already handles it.
The `[BLANK]` just makes the NCC solvable via comprehension instead of pure guessing.

### 3. Why no reconstruct() on-chain?
We don't need to verify the reconstructed narrative on-chain because:
- The attacker is INCENTIVIZED to make the blank contextually solvable
- If they make a nonsensical blank, the defender just guesses (25%) — same as now
- The Cloze test creates a carrot, not a stick

### Gas overhead
- `verifyBlank()`: ~34K gas (one linear scan for `[BLANK]`)
- Total per turn: ~34K additional (within budget)

## Decision for Egor
- **Mandatory Cloze** (revert without `[BLANK]`): scripts die immediately
- **Optional Cloze** (configurable per battle): backward compatible, gradual rollout
- **Recommended**: config flag (optional per battle), default to enabled for new battles
