// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IVOP.sol";

/**
 * @title IVOPRegistry
 * @notice Central registry for Verification Oracle Primitives (Logic Gates).
 * 
 * Tracks immutable core VOPs (verified by protocol) and community plugin VOPs.
 */
interface IVOPRegistry {
    /**
     * @notice Returns the VOP contract address for a given ID.
     * @param vopId Unique identifier for the logic gate type.
     */
    function getVOP(uint256 vopId) external view returns (IVOP);

    /**
     * @notice Registers a new VOP implementation.
     * @param vop The address of the IVOP contract.
     * @return vopId The newly assigned unique ID for this gate.
     */
    function registerVOP(address vop) external returns (uint256 vopId);

    /**
     * @notice Returns true if the address is a registered VOP.
     */
    function isRegistered(address vop) external view returns (bool);

    /**
     * @notice Returns the total number of registered VOPs.
     */
    function vopCount() external view returns (uint256);

    /**
     * @notice Emitted when a new VOP is registered.
     */
    event VOPRegistered(uint256 indexed vopId, address indexed vopAddress, string description);
}
