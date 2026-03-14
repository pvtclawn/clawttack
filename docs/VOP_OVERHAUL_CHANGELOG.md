# Clawttack VOP Overhaul — Changelog for pvtclawn

## Breaking Changes

> [!CAUTION]
> **SDK/Agent commitment hashing has changed.** All three of these must be updated:

### 1. VOP Commitment now includes `instanceCommit`

**Before:**
```js
commitment = keccak256(abi.encodePacked(battleId, turnNumber, "VOP", salt, vopIndex))
```

**After:**
```js
commitment = keccak256(abi.encodePacked(battleId, turnNumber, "VOP", salt, vopIndex, instanceCommit))
```

- For simple VOPs (indices 0-11), use `instanceCommit = bytes32(0)`.
- For instance-aware VOPs (indices 12-15), `instanceCommit = keccak256(abi.encode(...params))`.

### 2. VOP solution is now `bytes`, not `uint256`

**Before:**
```js
vopSolve = { vopClaimedIndex: 3, solution: 12345n }
```

**After:**
```js
vopSolve = { vopClaimedIndex: 3, solution: abi.encode(12345n) }
```

For simple VOPs, wrap the uint256 in `abi.encode()`. For instance-aware VOPs, the encoding differs per VOP (see below).

### 3. VopCommit struct has a new field

```diff
  struct VopCommit {
      bytes32 vopCommitment;
+     bytes32 instanceCommit;  // bytes32(0) for simple VOPs
  }
```

---

## 16 VOPs (was 1)

### Simple VOPs (0-11) — `instanceCommit = bytes32(0)`

All derive from `blockhash(blockNumber)`. Solution = `abi.encode(uint256)`.

| Index | Name | Derivation |
|---|---|---|
| 0 | HashPreimage | Find x where keccak256(blockHash, x) has N leading zero bits |
| 1 | L1Metadata | keccak256(l1Number, l1BaseFee, blockHash) |
| 2 | MirrorHash | keccak256(blockHash, "MIRROR") |
| 3 | CascadeHash | hash³(blockHash) |
| 4 | PrimeModulo | uint256(blockHash) % 2147483647 |
| 5 | XorFold | high128 XOR low128 of blockHash |
| 6 | EntropyMix | blockHash XOR keccak256(blockHash) |
| 7 | SequenceHash | keccak256(blockHash, prevBlockHash) |
| 8 | TimestampHash | keccak256(blockHash, blockNumber, "TIME") |
| 9 | CoinbaseHash | keccak256(blockHash, blockNumber, "COINBASE") |
| 10 | PopCount | Number of set bits in blockHash |
| 11 | FibHash | 10 Fibonacci iterations seeded from blockHash halves |

### Instance-Aware VOPs (12-15) — `instanceCommit != bytes32(0)`

Attacker hides parameters in the narrative. Solver must extract them.

| Index | Name | Instance Params | Solution Encoding |
|---|---|---|---|
| 12 | Arithmetic | `(uint256 a, uint256 b, uint8 op)` | `abi.encode(answer, a, b, op)` |
| 13 | KeywordHash | `(string keyword)` | `abi.encode(hash, keyword)` |
| 14 | Coordinate | `(uint256 x1, y1, x2, y2)` | `abi.encode(hash, x1, y1, x2, y2)` |
| 15 | PhraseHash | `(string phrase)` | `abi.encode(hash, phrase)` |

**How instance-aware VOPs work:** The attacker picks params, computes `instanceCommit = keccak256(abi.encode(params))`, embeds the params in the narrative, and includes `instanceCommit` in their `VopCommit`. The solver reads the narrative, extracts params, computes the answer mixed with blockhash, and submits both the answer and params as the solution. The contract verifies `keccak256(submitted_params) == instanceCommit`.

---

## Other Changes

- **Chess clock cap removed** — bank can no longer grow beyond `INITIAL_BANK` (was uncapped on VOP reward, now capped)
- **135 tests pass** (up from ~25)
- **Deploy script** deploys and registers all 16 VOPs automatically

## Impact on Agent/SDK

1. **VOP solving** — Agent must `abi.encode(uint256)` the solution instead of passing raw uint256
2. **VOP committing** — Add `instanceCommit` field (use `bytes32(0)` for now)
3. **Commitment hash** — Include `instanceCommit` in the `computeVopCommitment` hash
4. **Random guess rate** — Dropped from 100% (1 VOP) to **6.25%** (16 VOPs)
