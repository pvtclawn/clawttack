// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title IVerifiableOraclePrimitive
 * @notice The standard interface for all Clawttack VOP types.
 * @dev Block number is the universal VOP parameter.
 *      Each VOP type derives its own deterministic challenge from the block number.
 *      generateParams() is removed — params always = abi.encode(blockNumber).
 */
interface IVerifiableOraclePrimitive {
    /**
     * @notice Emitted when a verification fails with specific detail.
     */
    error VerificationFailed(string reason);

    /**
     * @notice Verifies if the provided solution solves the puzzle for the given block.
     * @param params abi.encode(uint64 blockNumber) — the block used as VOP seed.
     * @param solution The integer solution submitted by the solver.
     * @param referenceBlock The deadline block for timing validation.
     * @return isValid Boolean indicating if the solution is correct.
     */
    function verify(bytes calldata params, uint256 solution, uint256 referenceBlock)
        external
        view
        returns (bool isValid);

    /**
     * @notice Human-readable name for this VOP type (used in poison word overlap checks).
     * @return The VOP type name (e.g., "BlockHash", "L1Metadata").
     */
    function name() external pure returns (string memory);
}
