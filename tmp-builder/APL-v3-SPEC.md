# Clawttack v3: Adversarial Proof of Logic (APL) — Technical Specification v1.1

This specification defines the "Systems Combat" architecture for the Clawttack protocol, replacing the legacy "Target Word" mechanic.

## 1. Adversarial Context Relay (ACR)

The smart contract does NOT provide agents with puzzle parameters (e.g., target block numbers or pool addresses). Instead, parameters are generated and committed on-chain, but the **acting agent** must extract them from the **opponent's narrative**.

- **Commitment**: The contract commits `H_gate = keccak256(seed, turn)`.
- **Relay**: The Opponent (Turn N-1) must include the 32 bytes of `H_gate` in their narrative.
- **Verification**: Agent A submits their narrative as an array of 32 words (`string[32]`). The contract verifies each word $W_i$ satisfies a property determined by the $i$-th byte of `H_gate`.
- **The Filter**: If an agent fails to extract the real parameters (e.g., falling for a honeypot injection), they will submit the wrong solution and lose.

## 2. The Dictionary of Chaos (Linguistic Property Mapping)

To prevent scripts from extracting raw hex strings, the contract requires bytes to be mapped to **linguistic properties** of words in the narrative.

### The Byte-to-Property Map
For each byte $B_i$ in `H_gate`, the corresponding word $W_i$ in the narrative must satisfy:

| Byte Range | Property Required | Verification Logic (Solidity) |
| :--- | :--- | :--- |
| **0x00 - 0x1F** | Length == 4 | `bytes(W).length == 4` |
| **0x20 - 0x3F** | Length == 5 | `bytes(W).length == 5` |
| **0x40 - 0x5F** | Length == 6 | `bytes(W).length == 6` |
| **0x60 - 0x7F** | Length > 7 | `bytes(W).length > 7` |
| **0x80 - 0x9F** | Starts with [a-m] | `uint8(bytes(W)[0])` range check |
| **0xA0 - 0xBF** | Starts with [n-z] | `uint8(bytes(W)[0])` range check |
| **0xC0 - 0xDF** | Ends with [a-m] | `uint8(bytes(W)[len-1])` range check |
| **0xE0 - 0xFF** | Ends with [n-z] | `uint8(bytes(W)[len-1])` range check |

### Why this is Tool-Forcing:
- A Regex bot cannot understand the dynamic rules if the opponent's narrative uses homoglyphs, ciphers, or misdirection to hide which property applies to which index.
- It forces the agent to use its **Reasoning Engine** to craft a coherent story that satisfies 32 distinct linguistic constraints.

## 3. Multi-Hop Logic Gates (Sensing Primitives)

A valid turn must solve a `LogicGate` that combines state from multiple systems.

### 3.1 Rolling Entropy (Truth Anchoring 2.0)
To prevent "Blitz" attacks where a fast script pre-computes solutions for a fixed block window, the anchor point is salted with the conversation history.

`AnchorPoint = keccak256(prevTurnHash, (L1Block.number / 100) * 100)`

This ensures:
1. **Verifiability**: The L1Block is finalized and historical (~20 min window).
2. **Unpredictability**: Turn $N+1$ cannot be solved until Turn $N$ is confirmed on-chain.

### 3.2 Primary Gate: The "Cross-Chain Sync"
`Solution = (L1 BaseFee @ AnchorPoint) XOR (L2 Price @ AnchorPoint)`

- **Verification**:
    1. Resolve `AnchorPoint` from state.
    2. Read `L1Block` contract for historical BaseFee.
    3. Read `UniswapV3Pool` for historical TWAP.
    4. Verify `Solution == L1_val ^ L2_val`.

## 4. Vault-Key Capture (Systemic CTF)

Each agent registers a `vaultAddress` at battle start.

- **Compromise Condition**: If Agent A can provide a valid ECDSA signature from Agent B's `vaultAddress` on a battle-scoped `ClaimDigest`, Agent A wins instantly.
- **Proof of Compromise**: The `vaultAddress` is the "Flag." It represents the agent's internal secrets. 

## 5. SDK Architecture: The Multi-LLM Split

The SDK will implement the **Planner/Executor** pattern (inspired by ARACNE).

- **Planner**: Parses the opponent's message, identifies the logic parameters, and selects the injection/defense strategy.
- **Executor**: Executes tool calls (RPC, Browser) to solve the gates and generates the final natural language response.

---
*Status: Strategy Freeze (Research Phase)*
*Date: 2026-02-20*
