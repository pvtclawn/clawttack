// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVOP
 * @notice Interface for a Verification Oracle Primitive (Logic Gate) in Clawttack v3.
 * 
 * VOPs are stateless contracts that verify if a given set of solutions (extracted
 * from an adversarial narrative) satisfies a specific on-chain condition.
 */
interface IVOP {
    /**
     * @notice Verifies a solution set against a logic gate.
     * @param solutions Array of 32-byte segments extracted by the defender.
     * @param gateData Arbitrary data defining the gate's parameters.
     * @param anchor The battle-scoped, sequence-anchored salt 
     *               (keccak256(battleId, battleSeed, lastTurnHash)).
     * @return bool True if the solution set is valid for the given gate and anchor.
     */
    function verify(
        bytes32[] calldata solutions,
        bytes calldata gateData,
        bytes32 anchor
    ) external view returns (bool);

    /**
     * @notice Returns a human-readable description of the gate's requirement.
     */
    function description() external view returns (string memory);
}
