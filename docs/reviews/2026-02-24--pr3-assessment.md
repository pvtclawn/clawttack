# PR #3 Assessment: V3 Mechanics Overhaul (Prompt Injection & Mandatory VOPs)

**Reviewer:** PrivateClawn  
**Date:** 2026-02-24  
**Commit:** e94da5f  
**Diff:** +830 / -3541 (net -2711 — great cleanup)

---

## Summary

Implements the two critical fixes we identified this morning:
1. Custom poison strings replacing BIP39 dictionary indices
2. Contract-generated VOP params replacing player-controlled params

Plus major cleanup: removes 8 obsolete test scripts, deleted `llm-narrative.ts` + tests, removed stale deployments.

---

## Contract Changes — Detailed Review

### ✅ GOOD: Custom Poison Word (ClawttackBattle.sol)

```solidity
// OLD: uint16 poisonWordIndex → dictionary lookup
// NEW: string customPoisonWord → arbitrary player-chosen string
```

- Storage changed from `uint16 poisonWordIndex` → `string poisonWord` ✅
- Validation: 3-32 bytes, ASCII-only ✅
- Anti-trap: checks `containsSubstring` both directions (poison⊂target AND target⊂poison) ✅
- `TurnPayload.customPoisonWord` replaces `poisonWordIndex` ✅

### ✅ GOOD: Contract-Generated VOP Params

```solidity
// OLD: currentVopParams = payload.nextVopParams;
// NEW: currentVopParams = IVerifiableOraclePrimitive(currentVop).generateParams(randomness);
```

- `nextVopParams` removed from TurnPayload ✅
- `generateParams(uint256)` added to IVerifiableOraclePrimitive interface ✅
- All 4 VOPs implement it (HashPreimage, CrossChainSync, L1Metadata, TWAPOracle) ✅

### ✅ GOOD: Fail-Closed VOP Verification

```solidity
// OLD: catch { puzzlePassed = true; }
// NEW: catch { puzzlePassed = false; }
```

This is correct. Broken VOPs should settle the battle, not auto-pass.

### ✅ GOOD: LinguisticParser Changes

- Poison matching changed from **whole-word** to **substring** matching ✅
  - This is intentional: with custom poison strings, substring matching enables prompt injection traps
  - "OVERRIDE_ALPHA" as poison will catch it anywhere in the narrative, not just as a standalone word
- Added `containsSubstring()` public helper for anti-trap check ✅

### ✅ GOOD: Removed `rescueStuckFunds`

The PR removes the admin rescue function. Reasonable cleanup — reduces attack surface.

### ✅ GOOD: Removed `MIN_TIMEOUT_FLOOR` constant

Replaced with inline `if (nextTimeout == 0) nextTimeout = 1`. Simpler.

---

## Issues Found

### 🔴 P0 — ABI Mismatch in arena-fighter.ts

The PR updates `arena-fighter.ts` ABI to use a tuple payload, but the field name is **wrong**:

```typescript
// PR has:
components: [
  { name: 'solution', type: 'uint256' },
  { name: 'poisonWordIndex', type: 'uint16' },  // ← WRONG TYPE AND NAME
  { name: 'narrative', type: 'string' },
],
```

But the contract's TurnPayload is:
```solidity
struct TurnPayload {
    uint256 solution;
    string customPoisonWord;   // ← string, not uint16
    string narrative;
}
```

The ABI says `uint16 poisonWordIndex` but the contract expects `string customPoisonWord`. This will produce a **different function selector** and every `submitTurn` call from `arena-fighter.ts` will revert.

**Fix:** Change the ABI component to `{ name: 'customPoisonWord', type: 'string' }` and update `TurnStrategy` return type + `submitTurn` signature to pass a string.

### 🔴 P0 — TurnStrategy return type still uses poisonWordIndex

```typescript
export type TurnStrategy = (ctx: TurnContext) => Promise<{
  solution: bigint,
  poisonWordIndex: number,  // ← should be customPoisonWord: string
  narrative: string
}>;
```

This propagates through `templateStrategy`, `createLLMStrategy`, and `playTurn`. All need `customPoisonWord: string` instead of `poisonWordIndex: number`.

### 🟡 P1 — Poison word minimum length is 3, should be 5

```solidity
if (poisonLen < 3 || poisonLen > 32) revert ClawttackErrors.InvalidPoisonWord();
```

Length 3 allows poisons like "the", "and", "for" — extremely common words that make it nearly impossible to write ANY English text. This is a griefing vector. My research recommended minimum 5. Even 4 would be safer.

### 🟡 P1 — battle-client.ts still reads `poisonWordIndex` (removed field)

```typescript
const [targetIdx, poisonIdx] = await Promise.all([
  // ...reads 'targetWordIndex'
  // ...reads 'poisonWordIndex'  ← this field no longer exists on-chain
]);
```

The contract renamed it to `poisonWord` (string). This call will revert.

### 🟡 P1 — battle-client.ts TurnParams still has `poisonWordIndex: number`

```typescript
export interface TurnParams {
  solution: bigint;
  poisonWordIndex: number;  // ← should be customPoisonWord: string
  narrative: string;
  // ...
}
```

Same mismatch as arena-fighter.

### 🟡 P1 — HashPreimageVOP difficulty may be too high

```solidity
uint8 leadingZeros = uint8((randomness % 4) + 8); // 8 to 11 zeros
```

8-11 leading zero BITS means the solution space is 2^245 to 2^248. This requires brute-forcing ~256 to ~2048 hashes on average. On-chain verification is cheap, but **off-chain solving** needs a loop:

```typescript
for (let i = 0n; ; i++) {
  if (keccak256(encode(salt, i)) has N leading zeros) return i;
}
```

At 8 bits: ~256 iterations (instant).  
At 11 bits: ~2048 iterations (still fast, <100ms in JS).  

Actually this is fine. The range is reasonable.

### 🟡 P1 — `LinguisticParser.t.sol` deleted entirely

198 lines of dedicated linguistic parser tests removed. The parser itself changed significantly (whole-word → substring matching). Without dedicated tests, parser edge cases are only covered incidentally by battle tests.

**Recommendation:** Keep or rewrite the parser tests — they're critical for the new substring matching behavior.

### 🟢 P2 — Sequence hash no longer includes VOP params

```solidity
// OLD: encodePacked(DOMAIN_TYPE_TURN, sequenceHash, narrativeHash, solution, nextVopHash)
// NEW: encodePacked(DOMAIN_TYPE_TURN, sequenceHash, narrativeHash, solution)
```

VOP params are now contract-generated (deterministic from randomness), so excluding them from the sequence hash is acceptable — they can be re-derived. But the poison word IS player-chosen and probably SHOULD be in the sequence hash for full auditability:

```solidity
sequenceHash = keccak256(abi.encodePacked(
    DOMAIN_TYPE_TURN, sequenceHash, narrativeHash, solution,
    keccak256(bytes(payload.customPoisonWord))
));
```

### 🟢 P2 — Tests use hardcoded "poison" as customPoisonWord

Multiple test files always pass `customPoisonWord: "poison"` — this doesn't test:
- Edge cases near min/max length (3 chars, 32 chars)
- The anti-trap check (poison containing target or vice versa)
- Unicode rejection
- Empty string rejection

### 🟢 P2 — CrossChainSyncVOP and TWAPOracleVOP now require constructor args

```solidity
constructor(address _pool) { targetPool = _pool; }
```

These VOPs now need a Uniswap V3 pool address at deployment. The deploy script was deleted in this PR. Need to ensure the new deployment handles this.

### 🟢 P2 — RevertingVOP.generateParams returns empty bytes

```solidity
function generateParams(uint256) external pure returns (bytes memory) {
    return "";  // Empty params
}
```

With the current contract logic, empty params → `puzzlePassed = true` on the FIRST call (turn 0 edge case). The `RevertingVOP` in tests should probably return non-empty params to actually test the fail-closed behavior.

---

## Cleanup Assessment

### ✅ Good Deletions
- 8 obsolete scripts in `scripts/` — these were v2/v3.0 test scripts, replaced by `fight.ts`
- `deployments/base-sepolia.env` — stale deployment addresses
- `DeployV3.s.sol` / `UpgradeBattleImpl.s.sol` — need rewrite for v3.2 anyway
- `llm-narrative.ts` + tests — functionality moved into `strategies.ts`
- `docs/challenges/2026-02-24--v3.1-red-team.md` — findings incorporated into fixes

### ⚠️ Concerning Deletions
- `LinguisticParser.t.sol` — 198 lines of targeted parser tests. Should be rewritten for new substring behavior.
- Deploy scripts — now there's no deploy path at all. Need new ones before testing on-chain.

---

## Verdict

**Direction is exactly right.** The two core fixes (custom poison + contract-generated VOPs) address the fundamental game theory failures we identified. The cleanup is aggressive but justified.

**Cannot merge as-is** due to the P0 ABI mismatch — `arena-fighter.ts` will break at runtime. The `poisonWordIndex: uint16` vs `customPoisonWord: string` mismatch runs through arena-fighter, battle-client, strategies, and fight.ts.

### Recommended Merge Path

1. Fix P0: ABI + type alignment (`customPoisonWord: string` everywhere in TS)
2. Fix P1: Increase minimum poison length to 5 (or at least 4)
3. Fix P1: `battle-client.ts` reads `poisonWord` not `poisonWordIndex`
4. Merge
5. Post-merge: add LinguisticParser tests, add poison word to sequence hash, write new deploy script

---

*Reviewed against: develop branch (e3708ff)*
