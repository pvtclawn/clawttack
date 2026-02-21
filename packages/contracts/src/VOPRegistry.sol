// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { IVerifiableOraclePrimitive } from "./interfaces/IVerifiableOraclePrimitive.sol";
import { ClawttackErrors } from "./libraries/ClawttackErrors.sol";

/**
 * @title VOPRegistry
 * @notice Maintains the whitelist of approved Verifiable Oracle Primitives (Logic Gates).
 * @dev Used by the Clawttack Arena to randomly assign puzzles.
 */
contract VOPRegistry {
    address public immutable owner;
    
    // Array of active VOPs for random selection
    address[] public activeVOPs;
    
    // Mapping for quick lookup and removal
    mapping(address => bool) public isVOPRegistered;

    event VOPAdded(address indexed vopAddress);
    event VOPRemoved(address indexed vopAddress);

    modifier onlyOwner() {
        if (msg.sender != owner) revert ClawttackErrors.OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Adds a new VOP to the registry.
     * @param vopAddress The contract address of the new VOP.
     */
    function addVOP(address vopAddress) external onlyOwner {
        if (isVOPRegistered[vopAddress]) revert ClawttackErrors.VOPAlreadyRegistered();
        
        isVOPRegistered[vopAddress] = true;
        activeVOPs.push(vopAddress);
        
        emit VOPAdded(vopAddress);
    }

    /**
     * @notice Removes a VOP from the registry.
     * @param vopAddress The contract address to remove.
     */
    function removeVOP(address vopAddress) external onlyOwner {
        if (!isVOPRegistered[vopAddress]) revert ClawttackErrors.VOPNotRegistered();
        
        isVOPRegistered[vopAddress] = false;
        
        // Find and remove from the array
        for (uint256 i = 0; i < activeVOPs.length; i++) {
            if (activeVOPs[i] == vopAddress) {
                // Move the last element to the deleted spot to maintain dense array
                activeVOPs[i] = activeVOPs[activeVOPs.length - 1];
                activeVOPs.pop();
                break;
            }
        }
        
        emit VOPRemoved(vopAddress);
    }

    /**
     * @notice Selects a random VOP from the registry using a provided seed.
     * @param seed The random seed (usually derived from prevrandao).
     * @return The address of the selected VOP.
     */
    function getRandomVOP(uint256 seed) external view returns (address) {
        if (activeVOPs.length == 0) revert ClawttackErrors.RegistryEmpty();
        
        uint256 index = seed % activeVOPs.length;
        return activeVOPs[index];
    }

    /**
     * @notice Returns the total number of registered VOPs.
     */
    function getVOPCount() external view returns (uint256) {
        return activeVOPs.length;
    }
}
