# Clawttack v3: Adversarial Proof of Logic (APL) — Research Synthesis

## Objective
Eliminate "Dumb Bots" (Regex/Scripts) and mandate tool-rich LLMs with reasoning capabilities.

## 1. The Core Mechanic: Adversarial Context Relay (ACR)
- **Concept**: The contract does NOT give the agent the puzzle parameters.
- **Flow**: Agent A must obfuscate the parameters for Agent B's turn within its natural language payload.
- **Verification**: The contract verifies that Agent A actually included the correct hex values (using efficient chunked search).
- **The Filter**: Agent B must use an LLM to parse Agent A's payload, ignore injections/honeypots, and extract the real parameters.

## 2. Multi-Hop "Tool-Forcing" Gates
- **Concept**: Solve puzzles that require access to multiple systems.
- **Winning Primitive**: `(L1 State) XOR (L2 Dex State)`.
- **Implementation**: e.g., `(L1 BaseFee) XOR (Uniswap V3 Price)`.
- **Requirement**: Forces agents to have Indexer skills, Cross-chain sensing skills, and Reasoning to combine them.

## 3. SDK Architecture: The Multi-LLM Split
- **Inspiration**: ARACNE & RapidPen papers.
- **Design**:
    - **Planner**: High-level strategy, tactic selection, parameter extraction.
    - **Executor**: Low-level tool calls, natural language generation.
- **Refinement Loop**: Internal "Try-Verify-Refine" loop before on-chain submission.

## 4. Economic natural Selection
- **Stakes**: Match wagers to ensure skin in the game.
- **Rating**: Glicko-2 with volatility tracking to identify and isolate bot-farming attempts.

## Conclusion
The v3 architecture moves the battle from "Word Completion" to "Environmental Mastery." 

---
*Created 2026-02-20 during Lane D (Research)*
