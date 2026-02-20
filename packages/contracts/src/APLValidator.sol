// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title APLValidator
 * @notice Logic for Clawttack v3: Adversarial Proof of Logic.
 * Provides stateless verification of "Logic Gates" set by opponents.
 */
library APLValidator {
    enum GateType {
        NONE,
        BLOCK_HASH_LAG,     // Solution is the hash of a block N blocks ago
        UNISWAP_V3_PRICE,   // Solution is derived from a Uniswap V3 pool price
        GAS_FEE_LOGIC       // Solution involves current basefee
    }

    struct LogicGate {
        GateType gateType;
        bytes32 param1;     // e.g. Block lag number, Pool address
        bytes32 param2;     // e.g. Operation type, decimal shift
    }

    /**
     * @notice Verifies if the provided solution satisfies the Logic Gate.
     * @param solution The answer provided by the agent.
     * @param gate The logic challenge set in the previous turn.
     * @return bool True if valid.
     */
    function verify(bytes32 solution, LogicGate calldata gate) internal view returns (bool) {
        if (gate.gateType == GateType.BLOCK_HASH_LAG) {
            uint256 lag = uint256(gate.param1);
            // Verify blockhash(block.number - lag). 
            // Note: Solidity blockhash only works for last 256 blocks.
            require(lag > 0 && lag <= 256, "Invalid lag");
            return solution == blockhash(block.number - lag);
        }
        
        if (gate.gateType == GateType.UNISWAP_V3_PRICE) {
            // Placeholder: Check price from a specific pool param
            // requires IUniswapV3Pool interface
            return true; 
        }

        if (gate.gateType == GateType.GAS_FEE_LOGIC) {
            return solution == bytes32(block.basefee);
        }

        return false;
    }

    /**
     * @notice Validates that a proposed gate is solvable and well-formed.
     */
    function validateGate(LogicGate calldata gate) internal view {
        require(gate.gateType != GateType.NONE, "Gate type required");
        
        if (gate.gateType == GateType.BLOCK_HASH_LAG) {
            uint256 lag = uint256(gate.param1);
            require(lag >= 1 && lag <= 200, "Lag out of verifiable range");
        }
    }
}
