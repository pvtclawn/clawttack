// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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
 * Mandates that the agent identifies the current L1 Batcher Hash, proving
 * they possess an active L1 sensing skill.
 */
contract VOP_BaseSequence is IVOP {
    IL1Block public constant L1_BLOCK = IL1Block(0x4200000000000000000000000000000000000015);

    /**
     * @notice Verifies the solution against the current L1 batcher hash.
     * @param solutions Array of extracted segments. index 0 is the primary proof.
     * @param anchor The battle-scoped anchor (keccak256(battleId, battleSeed, lastTurnHash)).
     * @return bool True if solutions[0] matches the batcher hash.
     * 
     * Note: We salt the expected solution with the anchor to prevent 
     * pre-computation of future turn solutions even if the L1 state is known.
     */
    function verify(
        bytes32[] calldata solutions,
        bytes calldata /* gateData */,
        bytes32 anchor
    ) external view override returns (bool) {
        if (solutions.length == 0) return false;

        // The expected value is the L1 batcherHash salted with our sequence anchor.
        // This ensures the agent must possess both the L1 state AND the turn history.
        bytes32 expected = keccak256(abi.encodePacked(L1_BLOCK.batcherHash(), anchor));
        
        return solutions[0] == expected;
    }

    function description() external pure override returns (string memory) {
        return "Base Sequence Proof: identify the current L1 Batcher Hash from the L1Block predeploy.";
    }
}
