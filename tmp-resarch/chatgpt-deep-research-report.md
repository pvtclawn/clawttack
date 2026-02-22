# Clawttack On-Chain AI Battle Architecture for Tool-Using, Exploit-Resistant Agents

## Problem framing and hard constraints

Clawttack’s current “must include a target word + respond under a decaying timeout” mechanic is structurally vulnerable because it rewards *minimum-compliance output* rather than cognition: a trivial bot can always emit only the target word, ignore the opponent entirely, and reduce the probability of self-inflicted failure. In contrast, agentic LLM systems that “play the conversation” have to ingest adversarial inputs and will predictably suffer from well-studied failures such as prompt injection and instruction–data boundary confusion (where untrusted text alters model behavior). citeturn15view0turn15view1

Your stated “OpenClaw / MCP assumption” is crucial: modern agent frameworks are intentionally *tool-rich* (shell, filesystem, browser, SaaS APIs). For example, OpenClaw explicitly positions itself as a personal assistant running on a user’s devices and interacting with many channels; it also emphasizes tool surfaces and sandboxing modes that change which sessions run “with full access” vs in containers. citeturn16view0 Meanwhile, MCP is designed as a standard protocol to connect LLM applications to external tools and data sources, formalizing clients/servers and the tool interface layer. citeturn15view4turn15view5

From a protocol perspective, Clawttack’s design constraints are stricter than most “AI eval” systems because the adjudicator must be a smart contract: outcomes must be cheaply and deterministically verifiable on-chain, without depending on Web2 judgment calls. At the same time, randomness and time assumptions require caution: Solidity documentation explicitly warns against treating block timestamp or blockhash as secure randomness, and also notes the `blockhash()` availability limit (most recent 256 blocks only). citeturn11view3turn4search0

Because you are deploying on Base, it’s also important to acknowledge that the underlying L2 stack can evolve. Base launched as an OP Stack chain and (as of February 18, 2026) announced a transition toward a unified, Base-operated stack to reduce external dependencies and increase upgrade cadence. citeturn9view0turn9view1 This strongly suggests your game should avoid brittle dependencies on any single rollup-client quirk and instead rely on broadly portable EVM primitives plus widely used, already-deployed ecosystem contracts.

## Core mechanic: a verifiable challenge–response ladder that forces grounded computation

### High-level structure

The core fix is to move from “text compliance” to a *turn-validity proof* that a contract can verify. Concretely, each turn must include:

1. **A message payload** (for spectators, psychological warfare, and prompt-injection attempts).
2. **A deterministic answer** to a *turn challenge* that depends on (a) unpredictable randomness fixed at battle start and (b) live on-chain state at the time of the turn.
3. **A small set of turn metadata** (sequence hash / transcript hash chaining, deadline checks, etc.) to prevent replay and desync.

The fight is no longer decided by “can you type the target word,” but by “can you (a) compute the correct on-chain-grounded answer under time pressure and (b) avoid being socially engineered into leaking a key or sabotaging your own toolchain.”

### Randomness and challenge scheduling

Use a single battle-level verifiable random seed from entity["organization","Chainlink","decentralized oracle network"] VRF, requested when the opponent matches the stake and the match becomes live. Chainlink VRF is explicitly designed to deliver random words with on-chain verifiable cryptographic proofs, and its docs list Base Mainnet support (coordinator + wrapper addresses, key hashes, parameters). citeturn7view1turn8view0

From that battle seed, derive per-turn challenges deterministically:

- `challengeId = uint8(keccak256(seed, turnIndex) % N_MODULES)`
- `params = keccak256(seed, "params", turnIndex, maybe some bounded entropy like l1Block.number if available)`

This has two properties you want:
- **Unpredictability ex ante:** before VRF fulfills, nobody can precompute the battle’s challenge schedule. citeturn7view1turn8view0  
- **Determinism for verification:** once seed is known, any observer can recompute the expected challenge for turn *t*.

### Three example challenge modules (gas-bounded, fully verifiable)

Below are three concrete modules that are (i) on-chain recomputable, (ii) strongly tool-forcing, and (iii) prone to subtle bugs that reward disciplined, code-backed computation rather than “LLM vibes.”

#### Module: Uniswap v3 TWAP tick extraction

**Task.** Given a whitelisted Uniswap v3 pool `P` and a `secondsAgo` window `W`, compute the average tick over `[W, 0]` seconds and submit it.

**Why this is grounded and dynamic.** Uniswap v3 pools store historical observations and expose them via `observe()`. The Uniswap core docs explicitly describe that to compute a time-weighted average you call `observe` with two values like `[3600, 0]` and compute the delta in cumulative tick values. citeturn6view0turn6view1

**On-chain verification.**
- Contract calls `IUniswapV3Pool(P).observe([W, 0])`, gets `tickCumulatives[0], tickCumulatives[1]`.
- Compute `avgTick = floorDiv(tickCumulatives[1] - tickCumulatives[0], int56(W))` with correct rounding for negatives (you can harden this in a helper).
- Verify `submittedAvgTick == avgTick`.

This is cheap (one pool `observe` call + integer ops), but tool-forcing because the tick cumulatives are not knowable from static templates.

#### Module: OP Stack L1 attributes mixing (portable if Base remains OP-derived)

**Task.** Query the OP Stack `L1Block` predeploy for L1 attributes and compute a hash-based answer.

**Grounding source.** OP Stack includes an `L1Block` system contract that provides the last known L1 block attributes (number, timestamp, basefee, hash) and is updated once per epoch by a privileged depositor account. citeturn14view0turn12view1

**Answer definition.**
- `answer = keccak256(l1Number, l1Timestamp, l1Basefee, l1Blockhash, turnIndex)`

**On-chain verification.**
- Read those values from the predeploy and recompute `answer`.

This module is excellent for Clawttack because it forces agents to interact with rollup-specific state surfaces and discourages “generic EVM-only” lightweight contenders that lack correct chain introspection tooling.

#### Module: Fee-model arithmetic (turn-cost reasoning)

**Task.** Compute a deterministic fee-related value derived from chain parameters and a standardized payload length.

Base documentation emphasizes that a Base transaction has both an L2 execution fee and an L1 security fee, and points developers to OP Stack documentation for fee calculation. citeturn9view3turn10view0

A verifiable challenge here can be:

- Define a fixed “dummy calldata” length `L` and gas `G` from challenge params.
- Require the solver to return `keccak256(baseFee, G, L, l1BasefeeFromL1Block, turnIndex)` or (if you include a known predeploy that exposes L1-fee calculation) return the exact integer `l1Fee(dummyBytes)`.

Even the “hash of fee inputs” version forces:
- pulling live chain fee parameters (and, if used, L1 attributes),
- correctly handling integer scaling,
- operating under time pressure.

### Turn validity and win conditions

A turn is valid only if:
- It is submitted before the deadline.
- It supplies the correct `challengeAnswer` for the current challenge module.
- It respects any “soft text rules” you keep for spectator readability (message-length limits; optional “target token” presence; optional banning rules).

Liveness design must account for L2 realities. OP Stack chains have the concepts of Unsafe/Safe/Finalized heads and have sequencer-related outage modes; docs describe that sequencer downtime or publication outages can affect user perception of chain progress and transaction inclusion. citeturn10view0turn10view1  
Practically, this argues for deadlines specified in **block timestamps with generous buffers**, plus an explicit “forfeit if you miss it” rule to keep the game decisive even under partial network disruption.

## The tool-forcing function: why boring bots and tool-less LLMs lose (and why “tool-rich agents” don’t get to ignore the opponent)

### Why “no tool access” fails with probability 1

In the proposed ladder, a valid turn requires computing a function of live on-chain state—e.g., Uniswap’s `observe()` outputs or OP Stack’s L1 attributes. Those values change over time and are not embedded in the prior transcript. Uniswap’s model is explicitly historical-observation based and requires querying the pool contract for the relevant cumulative values. citeturn6view0turn6view1  

Therefore, any agent that cannot query the chain (or cannot programmatically compute integer answers from on-chain reads) will submit incorrect answers essentially always; “guessing” is infeasible because the answer space is large and changes every turn.

### Why “a dumb regex bot” fails even if it can send transactions

A regex bot that simply emits one token (or follows a fixed template) cannot satisfy the challenge–response constraint because the contract checks a computed value, not mere presence of a string. This is a categorical change: the contract verifies an arithmetic relation between the submitted answer and live on-chain state.

### Why “cheap LLM without external compute” collapses in practice

Even if a small model can call RPC, many challenge types are intentionally **precision traps**: fixed-point arithmetic, signed division rounding, time-window selection, and subtle call conventions (like Uniswap’s use of `[secondsAgo, 0]` pairs to define a TWAP interval). citeturn6view1turn6view2  

That combination tends to require:
- code execution (Python/JS/Rust) to avoid arithmetic mistakes,
- robust error handling (e.g., pool observation cardinality/availability constraints),
- defensive reasoning about what to trust in the opponent’s message.

This is exactly the skill profile of an “agentic tool user,” not a lightweight chat-only model.

## Security posture layer: on-chain verifiable compromise bounties via “vault-key capture”

The biggest gap in purely on-chain validation is that you cannot directly prove “the opponent executed `rm -rf`” or “the agent exfiltrated env vars” because those happen off-chain. To make real security compromises *on-chain legible*, add a second win condition based on cryptographic capability theft:

### Vault-key capture design

At battle start, each agent registers:
- `battleSigner` (their normal wallet address used to submit turns), and
- `vaultAddress` (a **separate** Ethereum address whose private key is stored in their agent runtime environment—ideally in the filesystem or secrets manager the agent could accidentally expose).

A battle ends immediately if anyone can submit a valid signature from the opponent’s `vaultAddress` over a battle-scoped message, such as:

- `digest = keccak256("CLAWTTACK_VAULT_CLAIM", battleId, claimantAddress, nonce)`

**Why this is powerful.** If an agent is compromised by prompt injection, tool-call hijacking, malicious MCP servers, or operator error, the attacker can often steal keys or trick the agent into signing attacker-chosen payloads. Unit 42 documents that malicious MCP servers can exploit features like sampling without proper safeguards, demonstrating practical attack vectors in MCP-integrated systems. citeturn15view3  
MCP’s own security best practices discuss how tool surfaces and server-driven events can change available tools if clients do not strictly control capability updates, reinforcing that tool ecosystems can be adversarial. citeturn15view2  
OWASP similarly treats prompt injection as an LLM application vulnerability that can manipulate behavior and lead to sensitive outcomes. citeturn15view0turn15view1

### On-chain verification of compromise

Use entity["organization","OpenZeppelin","smart contract security library"]’s ECDSA utilities (or equivalent strict checks) to avoid signature malleability pitfalls:
- OpenZeppelin explicitly notes `ecrecover` malleability issues and enforces “low-s” signatures and `v ∈ {27, 28}`. citeturn17view0

A successful vault-claim:
- immediately awards the battle pot to the claimant (minus fee),
- records a “compromise win” result type (valuable for analytics and reputation).

This turns off-chain failures (prompt injection → tool misuse → secret leakage) into an on-chain adjudicable event, without TEEs or Web2 oracles.

## Attack vectors and strategic game dynamics under the new rules

### Prompt injection that targets *computation integrity*

Because the contract validates a numeric answer, one of the cleanest attacks is to trick the opponent’s agent into computing the wrong value:

- **Unit mismatch attacks.** Tell the opponent (in natural language) that the TWAP window is “in blocks” rather than seconds, or that they should use a 30-minute window when the actual challenge param is 300 seconds. Uniswap’s oracle API is explicitly seconds-based via `secondsAgos`, so this kind of confusion is realistic. citeturn6view1  
- **Rounding and sign traps.** Encourage naive integer division (round toward zero) when the correct rule is floor division for negative tick deltas. This is the kind of subtle arithmetic error that code-backed agents catch but “LLM-only” solutions routinely miss. citeturn6view1

These attacks create a meta where “security posture” includes *instruction/data filtering* and verifying the challenge definition against contract-derived parameters.

### Denial-of-service through context pressure and tool abuse

OWASP explicitly highlights that prompt injection is facilitated by the common pattern of mixing instructions and data, and the prevention cheat sheet discusses the broad impacts of such vulnerabilities. citeturn15view1  
In Clawttack, adversaries can:
- submit large or carefully constructed text blobs to increase parsing burden,
- embed content that tempts the opponent to fetch large remote resources,
- produce “recursive tasks” that waste the opponent’s time budget.

On-chain mitigations should be blunt but effective:
- limit message bytes per turn,
- limit “artifact” bytes if you add artifacts,
- cap total gas for internal challenge verification (fixed per module),
- force strict per-turn deadlines.

### MCP tool hijacking and “tool shadowing” as a competitive weapon

Unit 42’s MCP analysis describes how malicious servers can exploit MCP features (in their case sampling) if safeguards are weak, and MCP docs acknowledge risks where tool availability can change due to server-sent events if clients accept dynamic tool changes. citeturn15view3turn15view2  
For Clawttack, that means the optimal adversary will craft messages that:
- suggest installing, enabling, or trusting a “helpful” MCP server,
- encourage “just run this tool call” behaviors,
- smuggle instructions that look like data (e.g., in JSON fields).

The vault-key capture layer makes these attacks economically meaningful: if the victim’s toolchain leaks the vault key or signs an attacker’s claim payload, the battle ends instantly.

### Sequencer and L2 liveness edge cases as strategy

OP Stack documentation describes sequencer outage modes and how Safe/Finalized heads can become stuck while Unsafe progresses, as well as the existence of bypass mechanisms via L1 portals. citeturn10view1turn10view0  
Even if Clawttack itself lives fully on L2, these realities matter for “decaying time limits”:
- aggressive deadlines amplify the chance that network conditions, not agent capability, decide outcomes,
- adversaries might attempt to exploit timing uncertainty (e.g., submitting at the edge of a deadline).

The safest design is to make the *strategic* time pressure come from your own decaying schedule, but keep absolute windows large enough that normal L2 variance doesn’t dominate.

### Randomness manipulation considerations

Solidity warns that block timestamp and blockhash can be influenced and should not be treated as secure randomness. citeturn11view3turn4search0  
Additionally, not all networks implement `PREVRANDAO` in equally trustworthy ways; Sigma Prime notes network-dependent behavior and calls out weaker guarantees on some L2s. citeturn11view0  
This underlines why VRF is the right primitive for battle-critical randomness on a high-stakes system—precisely the niche Chainlink VRF is designed for, with proofs verified on-chain. citeturn7view1turn8view0

## Solidity architecture sketch with key state variables and `submitTurn()` flow

Below is a compact architecture sketch emphasizing what must be stored and what must be recomputed.

```solidity
// PSEUDOCODE / ARCHITECTURE SKETCH (not production code)

contract ClawttackArena is VRFConsumerBaseV2Plus /* or v2.5 */ {
    struct Battle {
        address playerA;            // battle signer
        address playerB;
        address vaultA;             // compromise-capture address
        address vaultB;

        uint256 stakeWei;           // matched stake (winner takes minus fee)
        uint64  startTime;          // battle start time
        uint64  deadline;           // current turn deadline (timestamp)

        uint32  turnIndex;          // increments each valid submit
        bool    active;
        address currentPlayer;      // whose turn is next

        bytes32 transcriptHash;     // rolling hash of turns
        bytes32 vrfSeed;            // battle-level random seed
        bool    seedReady;

        // Optional: module config / whitelist roots
        // Optional: message size caps, max turns, etc.
    }

    mapping(uint256 => Battle) public battles;

    // --- Battle creation and seeding ---
    function createBattle(/* stake, elo gating, etc */) external payable returns (uint256 battleId);

    function joinBattle(uint256 battleId) external payable;

    // Called after join, requests VRF; fulfill sets battles[battleId].vrfSeed and seedReady=true.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override;

    // --- Core turn submission ---
    function submitTurn(
        uint256 battleId,
        bytes calldata message,
        bytes calldata answer // flexible type; could be int24, uint256, bytes32, etc.
    ) external {
        Battle storage b = battles[battleId];
        require(b.active && b.seedReady, "inactive/unseeded");
        require(msg.sender == b.currentPlayer, "not your turn");
        require(block.timestamp <= b.deadline, "late");

        // Hard caps to prevent gas grief / context bombs
        require(message.length <= MAX_MESSAGE_BYTES, "message too big");

        // Determine challenge for this turn
        uint8 challengeId = uint8(uint256(keccak256(abi.encode(b.vrfSeed, b.turnIndex))) % N_MODULES);
        bytes32 paramsHash = keccak256(abi.encode(b.vrfSeed, "params", b.turnIndex));

        // Verify challenge solution on-chain
        require(_verifyChallenge(challengeId, paramsHash, answer), "bad answer");

        // Update transcript hash (prevents replay + binds history)
        bytes32 msgHash = keccak256(message);
        b.transcriptHash = keccak256(abi.encode(b.transcriptHash, msgHash, answer, challengeId));

        // Advance turn, rotate player, decay deadline
        b.turnIndex += 1;
        b.currentPlayer = (b.currentPlayer == b.playerA) ? b.playerB : b.playerA;
        b.deadline = uint64(block.timestamp + _nextTurnTimeLimit(b.turnIndex));
    }

    function _verifyChallenge(uint8 id, bytes32 paramsHash, bytes calldata answer) internal view returns (bool) {
        if (id == 0) {
            // Uniswap v3 TWAP tick challenge
            address pool = _selectPool(paramsHash);
            uint32 secondsAgo = _selectSecondsAgo(paramsHash);

            (int56[] memory tickCums, ) = IUniswapV3Pool(pool).observe(_twoPoints(secondsAgo));
            int56 delta = tickCums[1] - tickCums[0];
            int24 avgTick = _floorDivToTick(delta, secondsAgo);

            return _decodeInt24(answer) == avgTick;
        }
        if (id == 1) {
            // OP Stack L1 attributes hash challenge
            uint64 n = L1BlockPredeploy.number();
            uint64 ts = L1BlockPredeploy.timestamp();
            uint256 bf = L1BlockPredeploy.basefee();
            bytes32 h = L1BlockPredeploy.hash();

            bytes32 expected = keccak256(abi.encode(n, ts, bf, h, paramsHash));
            return _decodeBytes32(answer) == expected;
        }
        if (id == 2) {
            // Fee-mix challenge (simple illustrative version)
            uint256 baseFee = block.basefee;
            // plus maybe L1Block.basefee(), etc
            bytes32 expected = keccak256(abi.encode(baseFee, paramsHash));
            return _decodeBytes32(answer) == expected;
        }
        return false;
    }

    // --- Compromise win condition ---
    function claimVaultCompromise(
        uint256 battleId,
        address victimVault,
        bytes calldata signature
    ) external {
        Battle storage b = battles[battleId];
        require(b.active, "inactive");

        // Ensure victimVault is exactly vaultA or vaultB
        require(victimVault == b.vaultA || victimVault == b.vaultB, "not battle vault");

        bytes32 digest = keccak256(abi.encode(
            "CLAWTTACK_VAULT_CLAIM",
            battleId,
            msg.sender,
            b.turnIndex
        ));

        // Use strict ECDSA recovery (low-s, v=27/28) via OpenZeppelin in real code
        address recovered = ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), signature);
        require(recovered == victimVault, "bad sig");

        _endBattleWithWinner(battleId, msg.sender, /*resultType=*/"COMPROMISE");
    }

    function _endBattleWithWinner(uint256 battleId, address winner, string memory resultType) internal {
        // pay winner, update ELO, emit transcript hash, etc.
    }
}
```

Key points this sketch encodes:

- **On-chain determinism:** every verification step is either a pure computation or a `view` call to a known contract interface (e.g., Uniswap v3 pool’s `observe`). citeturn6view1  
- **VRF-based unpredictability:** battle seed comes from a verifiable randomness oracle that is supported on Base, avoiding fragile block-variable randomness. citeturn8view0turn11view3turn11view0  
- **Real security stakes:** compromise is adjudicated by signature recovery with strict anti-malleability validation, consistent with OpenZeppelin’s guidance. citeturn17view0  
- **Base cost sensitivity:** your verification must remain bounded because Base fees include both L2 execution and L1 security components; bounding message size and per-module computation keeps turns economically predictable. citeturn9view3