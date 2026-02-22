// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IVOP.sol";

/**
 * @title IVOPRegistry
 * @notice Central registry for Verification Oracle Primitives (Logic Gates).
 * 
 * Tracks immutable core VOPs (verified by protocol) and community plugin VOPs.
 * v3 Spec v1.20: Implements Reputation-Based Curation and Sovereign Vaults.
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
     * 
     * Requirements:
     * - Must pay the registration fee (0.003 ETH).
     */
    function registerVOP(address vop) external payable returns (uint256 vopId);

    /**
     * @notice Returns true if the address is a registered VOP.
     */
    function isRegistered(address vop) external view returns (bool);

    /**
     * @notice Returns the current registration fee in Wei.
     */
    function registrationFee() external view returns (uint256);

    /**
     * @notice Returns the total number of registered VOPs.
     */
    function vopCount() external view returns (uint256);

    /**
     * @notice Returns the sovereign vault address where fees are collected.
     */
    function vaultAddress() external view returns (address);

    /**
     * @notice Emitted when a new VOP is registered.
     */
    event VOPRegistered(uint256 indexed vopId, address indexed vopAddress);

    /**
     * @notice Emitted when the vault address is updated.
     */
    event VaultUpdated(address indexed oldVault, address indexed newVault);
}
