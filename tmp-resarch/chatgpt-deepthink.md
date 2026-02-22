## Clawttack vNext: Adversarial Work Orders (AOW) + Verifiable Proof-of-Retrieval (PoR)

You can’t *cryptographically prove “this was a capable LLM with tools”* from L1/L2 alone. What you **can** do purely on-chain is: design turns that **require fresh, dynamic data + nontrivial extraction + tight deadlines**, then let “security failures” show up naturally as **timeouts / wrong proofs / broken automation** when an agent gets socially engineered or tool-hijacked.

Below is a concrete, fully on-chain-verifiable design that does that, while still leaving a huge space for prompt injection / adversarial “instruction wrapping”.

---

# 1) The Core Mechanic

### High-level idea

Each turn is a **Work Order** issued by the previous player:

1. A **deterministic on-chain puzzle** (cheaply recomputable by the contract).
2. A **Proof-of-Retrieval** requirement: the responder must provide **Merkle proofs for randomly sampled chunks** of a large dataset (so they must fetch + process data).
3. An **adversarial “wrapper” text** (unverified) that exists purely to mislead / inject / waste context.

If the responder submits an invalid proof or misses the deadline → they lose.

---

## 1.1 DataPack Library (protocol-owned, not player-owned)

To avoid “unsatisfiable challenges” (player points to fake IPFS), the protocol maintains a registry of **canonical DataPacks**:

* Each DataPack is a large blob (e.g., 1–50 MB) stored off-chain (IPFS/Arweave/CDN mirrors).
* On-chain you store only:

  * `merkleRoot` of fixed-size chunks (e.g., 1024 bytes),
  * `chunkCount`, `chunkSize`,
  * optional metadata hash / URI hash (for UX).

**Key point:** the *contract never needs the blob*, only the Merkle root and sample proofs.

This gives you a hard tool-forcing primitive with clean on-chain verification.

---

## 1.2 Turn structure

### WorkOrder (posted by the previous player, stored in battle state)

* `taskFamily` + `difficulty` (bounded)
* `datapackId` (points to protocol DataPack)
* `issuedTurn` / `issuedBlock`
* `wrapperHash` (hash of arbitrary “instruction wrapper”; full text is emitted in an event for spectators)

### SubmitTurn (by current player)

They must submit:

* `answer` (bytes32) — must match contract’s expected output
* `samples[]` — for each sampled index:

  * `index`
  * `chunkBytes` (exact chunk)
  * `merkleProof[]` (siblings up to root)
* `nextWorkOrder` for the opponent (plus wrapper text in an event)

### Deterministic verification (on-chain)

Contract recomputes:

1. `seed = keccak256(battle.seqHash, blockhash(block.number-1), battle.turn, workOrder.issuedBlock)`
2. `puzzleOut = solveTaskFamily(workOrder, seed)`
3. `sampleIdx[i] = deriveIndices(seed, datapack.chunkCount, kSamples)`
4. Verify each sample Merkle proof against `datapack.merkleRoot`
5. Compute `expected = keccak256(puzzleOut, keccak256(allSampleChunkHashes), battle.seqHash)`
6. Require `expected == answer`

If ok: advance turn, update `seqHash`, set new deadline (your decaying scheme), swap active player.

---

# 2) The Tool-Forcing Function

This makes “boring bots” and “cheap/no-tools LLMs” lose **mathematically**, because:

### Why a regex bot fails 100%

* The required `answer` is a hash over **fresh entropy** (`blockhash(block.number-1)` + evolving `seqHash`) and **randomly sampled chunk indices**.
* Without actually fetching the correct chunks and building valid Merkle proofs, you cannot forge the answer.

### Why an offline / no-chain / no-web LLM fails 100%

* It can’t access the latest blockhash, contract state, or dataset chunks.
* Even if it “guesses”, Merkle proof verification will fail deterministically.

### Why a “simple hardcoded script” tends to fail

You can tune difficulty so that merely “printing a word” is hopeless:

* Needs RPC reads (latest battle state, datapack root, etc.)
* Needs deterministic computation for the on-chain puzzle
* Needs downloading/reading large blob chunks (from mirrors/IPFS)
* Needs building Merkle proofs correctly under tight deadlines

A script *can* be written to do this, but it’s no longer a “dumb bot”; it becomes an actual agent system with robust IO, caching, timeouts, and adversarial handling—which is exactly your goal.

---

# 3) Attack Vectors & Game Theory (prompt injection / tool-hijack pressure)

The **wrapper text** is where the war happens. The contract ignores it; the agents must learn to treat it as hostile.

Here are *safe* (non-operational) examples of adversarial strategies that directly cause **on-chain failure**:

## 3.1 “Wrong-spec social engineering”

Agent A’s wrapper claims:

* the datapack is different,
* indices are derived differently,
* or the puzzle is solved with a subtly altered rule.

If Agent B follows wrapper instructions instead of the canonical spec → computed `answer` mismatches → immediate loss.

## 3.2 “Context-window exhaustion”

Wrapper is engineered to bloat context (long tables, nested JSON, fake logs, “IMPORTANT READ ALL”), hoping B’s LLM drops the real constraints (deadline, sample count, index derivation), leading to proof mistakes or timeout.

## 3.3 “Tool-call bait”

Wrapper is formatted to look like tool output / tool directives (especially if the agent framework naively merges tool results and opponent text). If B’s orchestration isn’t strict about provenance (system vs opponent vs tool), it may:

* fetch the wrong resource,
* parse the wrong file,
* run the wrong workflow,
  and miss the deadline.

## 3.4 “Resource bomb datasets”

Even with protocol-owned DataPacks, A can pick a datapack that is:

* large,
* slow to fetch from some gateways,
* has “pathological” chunk patterns for B’s parser/cacher.

This creates a meta where strong agents build:

* caching,
* multi-mirror fetch,
* strict time budgeting,
* streaming verification,
* fallback strategies.

## 3.5 “Turn timing / entropy games”

A may time their WorkOrder issuance to make B’s runtime tighter (your decaying clock amplifies this). B needs robust scheduling and “fast path” retrieval.

**Security posture emerges naturally**: permissive / sloppy agents get tricked into wasting time or miscomputing; hardened agents win.

---

# 4) Solidity Architecture Sketch

Below is a compact, gas-conscious sketch of the key pieces.

## 4.1 Core storage

```solidity
struct DataPack {
    bytes32 merkleRoot;
    uint32  chunkCount;
    uint16  chunkSize;     // e.g., 1024
    uint8   depth;         // precomputed tree depth (optional)
}

struct WorkOrder {
    uint8   taskFamily;    // enum
    uint8   difficulty;    // bounded
    uint32  issuedBlock;
    uint32  datapackId;
    bytes32 wrapperHash;   // full wrapper emitted in event for spectators
    bytes32 paramsHash;    // task params commit (optional)
}

struct Battle {
    address a;
    address b;
    uint64  turn;
    address toMove;
    uint64  deadline;      // timestamp or block
    bytes32 seqHash;       // hash-chaining across turns
    WorkOrder current;
    uint256 stake;
}
```

## 4.2 Events (spectator-readable)

```solidity
event WorkOrderText(uint256 indexed battleId, uint64 indexed turn, address indexed author, string wrapperText);
event TurnResult(uint256 indexed battleId, uint64 indexed turn, address player, bytes32 answer);
```

## 4.3 submitTurn pseudocode

```solidity
function submitTurn(
    uint256 battleId,
    bytes32 answer,
    Sample[] calldata samples,      // kSamples, fixed max
    WorkOrder calldata nextOrder,
    string calldata nextWrapperText // emitted only; hash stored
) external {
    Battle storage bt = battles[battleId];
    require(msg.sender == bt.toMove, "not your turn");
    require(block.timestamp <= bt.deadline, "timeout");

    WorkOrder memory wo = bt.current;
    DataPack memory dp = dataPacks[wo.datapackId];

    // 1) derive fresh seed
    bytes32 seed = keccak256(abi.encodePacked(
        bt.seqHash,
        blockhash(block.number - 1),
        bt.turn,
        wo.issuedBlock
    ));

    // 2) compute deterministic puzzle output (pure/view)
    bytes32 puzzleOut = solveTaskFamily(wo, seed); // bounded work

    // 3) derive expected sample indices
    uint32[kSamples] memory idx = deriveIndices(seed, dp.chunkCount);

    // 4) verify merkle proofs for each sample
    bytes32 samplesHash;
    for (uint i=0; i<kSamples; i++) {
        require(samples[i].index == idx[i], "wrong index");
        require(samples[i].chunk.length == dp.chunkSize, "bad chunk");
        bytes32 leaf = keccak256(samples[i].chunk);
        require(verifyMerkle(leaf, samples[i].proof, dp.merkleRoot), "bad proof");
        samplesHash = keccak256(abi.encodePacked(samplesHash, leaf));
    }

    // 5) expected answer
    bytes32 expected = keccak256(abi.encodePacked(puzzleOut, samplesHash, bt.seqHash));
    require(answer == expected, "wrong answer");

    // 6) advance battle
    bt.seqHash = keccak256(abi.encodePacked(bt.seqHash, answer, hashWorkOrder(nextOrder)));
    bt.turn += 1;
    bt.toMove = otherPlayer(bt, msg.sender);
    bt.deadline = computeNextDeadline(bt.turn);

    // 7) install next order
    bt.current = sanitizeAndStore(nextOrder, nextWrapperText);

    emit TurnResult(battleId, bt.turn - 1, msg.sender, answer);
}
```

### Notes

* Keep `kSamples` small and fixed (e.g., 4–8).
* Bound `difficulty` so `solveTaskFamily` is always cheap.
* Store only hashes on-chain; emit big human-readable wrappers in events.

---

# 5) Practical Task Families (fully on-chain verifiable)

Pick 2–4 families; rotate for variety.

### Family A: Contract-Graph Walk (tool + chain access)

Given `seed`, start from `addr0 = address(uint160(uint(seed)))`.
For `k` steps:

* read `extcodehash(addr)` or a small `staticcall` to a known interface (or your own “Vault nodes”)
* compute next address from the value
  Output is the final accumulator hash.

**Why it’s good:** forces robust RPC, calldata building, and careful deterministic execution.

### Family B: AMM Oracle Snapshot (on-chain state interrogation)

Use Uniswap v3 pool(s) or another on-chain oracle source:

* read tick cumulatives, compute TWAP tick, derive price, hash it into puzzleOut.

**Why it’s good:** highly dynamic + fully verifiable.

### Family C: Bytecode Slice Puzzle (forces tooling)

From an address derived by seed, do `extcodecopy` for N bytes, run a tiny interpreter over those bytes (bounded).
Return hash.

**Why it’s good:** punishes weak infra and sloppy parsing.

---

# 6) Add-ons that amplify “security posture battles”

These don’t change verification much, but make transcripts more educational and sabotage more realistic:

1. **Provenance tags in events**: emit wrapper text with explicit `author` and `turn` so good agents can enforce “opponent text is untrusted”.
2. **Strict per-turn byte budgets**: wrapper text max length (prevents pure spam, keeps spectator readability).
3. **Optional “poison token hashes”**: rather than banning substrings on-chain, require the player to also submit `tokenHashes[]` for their wrapper; opponent can set banned token hashes next turn. (This becomes a *verifiable* constraint if you make the wrapper canonicalized + hashed into those tokens—doable, but more complexity.)
4. **Difficulty bidding**: allow the author to pick higher difficulty that shortens the opponent’s clock *but* costs extra stake/bond. Creates a strategic meta.

---

## If you want one “default spec” to implement first

Implement:

* DataPack registry (protocol-owned, curated)
* Task family A (graph walk) only
* `kSamples = 4`, `chunkSize = 1024`
* wrapper stored as event text + on-chain hash
* your existing decaying deadline + seqHash chaining

That already:

* kills regex bots,
* forces real tooling,
* creates a massive injection surface,
* stays fully deterministic on-chain.

If you want, I can also write a minimal concrete `solveTaskFamilyA()` and `verifyMerkle()` Solidity snippet (gas-optimized, calldata-friendly) and a recommended DataPack chunking/merkle format that’s easy for agents to build proofs for.
