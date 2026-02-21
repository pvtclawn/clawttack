// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IVOPRegistry.sol";
import "./interfaces/IVOP.sol";

/**
 * @title VOPRegistry
 * @notice Central registry for Verification Oracle Primitives (Logic Gates).
 * 
 * Clawttack v3 APL Spec v1.17:
 * - Stake-based registration (0.003 ETH) to prevent Sybil spam.
 * - Curation flags (isVerified) to distinguish audited primitives.
 * - Pure Sensing requirement: Verified VOPs must source truth from the chain, not users.
 * - Immutable Semantic Binding (SDK reads truth from VOP directly).
 */
contract VOPRegistry is IVOPRegistry {
    address public owner;
    uint256 public override registrationFee = 0.003 ether;
    uint256 public override vopCount;

    struct VOPInfo {
        IVOP implementation;
        bool isRegistered;
        bool isVerified;
        bool isPureSensing; // Spec v1.17: Truth derived from chain state, not gateData
    }

    mapping(uint256 => VOPInfo) private _vops;
    mapping(address => bool) private _isRegistered;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "OnlyOwner");
        _;
    }

    /**
     * @notice Returns the VOP contract address for a given ID.
     */
    function getVOP(uint256 vopId) external view override returns (IVOP) {
        require(_vops[vopId].isRegistered, "UnknownVOP");
        return _vops[vopId].implementation;
    }

    /**
     * @notice Registers a new VOP implementation.
     * Must pay the 0.003 ETH registration fee.
     */
    function registerVOP(address vop) external payable override returns (uint256 vopId) {
        require(msg.value >= registrationFee, "InsufficientFee");
        require(vop != address(0), "InvalidAddress");
        require(!_isRegistered[vop], "AlreadyRegistered");

        vopId = ++vopCount;
        _vops[vopId] = VOPInfo({
            implementation: IVOP(vop),
            isRegistered: true,
            isVerified: false,
            isPureSensing: false
        });
        _isRegistered[vop] = true;

        emit VOPRegistered(vopId, vop);
    }

    /**
     * @notice Admin method to verify and classify a VOP.
     * v1.17: isPureSensing must be set to true if truth is derived from immutable state.
     */
    function setVOPStatus(uint256 vopId, bool verified, bool pureSensing) external onlyOwner {
        require(_vops[vopId].isRegistered, "UnknownVOP");
        _vops[vopId].isVerified = verified;
        _vops[vopId].isPureSensing = pureSensing;
    }

    function isRegistered(address vop) external view override returns (bool) {
        return _isRegistered[vop];
    }

    function isVerified(uint256 vopId) external view returns (bool) {
        return _vops[vopId].isVerified;
    }

    function isPureSensing(uint256 vopId) external view returns (bool) {
        return _vops[vopId].isPureSensing;
    }

    function setRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "WithdrawFailed");
    }
}
