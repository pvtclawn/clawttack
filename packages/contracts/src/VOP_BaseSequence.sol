// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "./interfaces/IVOP.sol";

/**
 * @title L1Block
 * @notice Interface for the L1Block predeploy on Base.
 * Address: 0x4200000000000000000000000000000000000015
 */
interface IL1Block {
    function number() external view returns (uint64);
    function basefee() external view returns (uint256);
    function hash() external view returns (bytes32);
    function batcherHash() external view returns (bytes32);
}

/**
 * @title VOP_BaseSequence
 * @notice Verification Oracle Primitive for Base Sequencing Integrity.
 * 
 * Clawttack v3 APL Spec v1.8:
 * Mandates that the agent identifies the current L1 Batcher Hash salted
 * with the battleSeed (Entropy Padding). Implementing Immutable Semantic Binding.
 */
contract VOP_BaseSequence is IVOP {
    IL1Block public constant L1_BLOCK = IL1Block(0x4200000000000000000000000000000000000015);

    function version() external pure override returns (uint8) {
        return 1;
    }

    /**
     * @notice Verifies the solution against the current L1 batcher hash.
     * @param solutions Array of extracted segments. index 0 is the primary proof.
     * @param gateData ABI-encoded: (bytes32 battleSeed)
     * @param anchor The battle-scoped anchor (keccak256(battleId, battleSeed, lastTurnHash, BaseAnchor)).
     * @return bool True if solutions[0] matches the salted batcher hash.
     */
    function verify(
        bytes32[] calldata solutions,
        bytes calldata gateData,
        bytes32 anchor
    ) external view override returns (bool) {
        if (solutions.length == 0) return false;

        // Decode the entropy padding (battleSeed)
        bytes32 battleSeed = abi.decode(gateData, (bytes32));

        // 1. Calculate RawResult: L1 state salted with sequence anchor
        // This prevents pre-computation of future turns.
        bytes32 rawResult = keccak256(abi.encodePacked(L1_BLOCK.batcherHash(), anchor));

        // 2. Apply Entropy Padding (from Spec v1.6+)
        // This prevents brute-forcing during low-volatility periods.
        bytes32 expected = keccak256(abi.encodePacked(rawResult, battleSeed));
        
        return solutions[0] == expected;
    }

    function description() external pure override returns (string memory) {
        return "Base Sequence Proof: identify the current L1 Batcher Hash from the L1Block contract, salted with the sequence anchor and battle seed.";
    }

    function requirements() external pure override returns (string[] memory) {
        string[] memory reqs = new string[](1);
        reqs[0] = "L1_SCANNER";
        return reqs;
    }
}
