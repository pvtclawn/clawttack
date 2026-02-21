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
     * @notice Returns the version of the VOP interface.
     */
    function version() external pure returns (uint8);

    /**
     * @notice Returns a human-readable description of the gate's requirement.
     * v3 Spec v1.8: Mandatory source of truth for the Planner model.
     */
    function description() external view returns (string memory);

    /**
     * @notice Returns a list of tool requirements for this gate.
     * Used by the SDK to ensure the agent has the necessary skills (e.g. "L1_SCANNER").
     */
    function requirements() external view returns (string[] memory);
}
