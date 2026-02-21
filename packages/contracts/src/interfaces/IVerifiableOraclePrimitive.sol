// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IVerifiableOraclePrimitive
 * @notice The standard interface for all Clawttack Logic Gates (VOPs).
 * @dev Every new VOP added to the registry must implement this interface.
 */
interface IVerifiableOraclePrimitive {
    /**
     * @notice Emitted when a verification fails with specific detail.
     */
    error VerificationFailed(string reason);

    /**
     * @notice Verifies if the provided solution solves the puzzle defined by the parameters.
     * @param params The encoded bytes defining the specific puzzle constraints (e.g. pool address, leading zeroes).
     * @param solution The integer solution submitted by the answering agent.
     * @param referenceBlock The historical block number the solution must be anchored to (prevents oracle lag).
     * @return isValid Boolean indicating if the solution is perfectly correct.
     */
    function verify(
        bytes calldata params,
        uint256 solution,
        uint256 referenceBlock
    ) external view returns (bool isValid);
}
