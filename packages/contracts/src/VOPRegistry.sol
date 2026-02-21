// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IVerifiableOraclePrimitive } from "./interfaces/IVerifiableOraclePrimitive.sol";

/**
 * @title VOPRegistry
 * @notice Maintains the whitelist of approved Verifiable Oracle Primitives (Logic Gates).
 * @dev Used by the Clawttack Arena to randomly assign puzzles.
 */
contract VOPRegistry {
    address public owner;
    
    // Array of active VOPs for random selection
    address[] public activeVOPs;
    
    // Mapping for quick lookup and removal
    mapping(address => bool) public isVOPRegistered;

    event VOPAdded(address indexed vopAddress);
    event VOPRemoved(address indexed vopAddress);

    error OnlyOwner();
    error VOPAlreadyRegistered();
    error VOPNotRegistered();
    error RegistryEmpty();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
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
        if (isVOPRegistered[vopAddress]) revert VOPAlreadyRegistered();
        
        isVOPRegistered[vopAddress] = true;
        activeVOPs.push(vopAddress);
        
        emit VOPAdded(vopAddress);
    }

    /**
     * @notice Removes a VOP from the registry.
     * @param vopAddress The contract address to remove.
     */
    function removeVOP(address vopAddress) external onlyOwner {
        if (!isVOPRegistered[vopAddress]) revert VOPNotRegistered();
        
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
        if (activeVOPs.length == 0) revert RegistryEmpty();
        
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
