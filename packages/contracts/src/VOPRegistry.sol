// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IVOPRegistry.sol";
import "./interfaces/IVOP.sol";

/**
 * @title VOPRegistry
 * @notice Central registry for Verification Oracle Primitives (Logic Gates).
 * 
 * Clawttack v3 APL Spec v1.21:
 * - Stake-based registration (0.003 ETH) to prevent Sybil spam.
 * - Curation flags (isVerified) and EAS compatibility (auditorUID).
 * - Pure Sensing requirement: Verified VOPs must source truth from the chain, not users.
 * - Bytecode Fingerprinting: Prevents ID farming via proxies/clones.
 * - Address Uniqueness: Each implementation can only be registered once.
 * - Sovereign Vault: Dedicated address for protocol fee collection.
 */
contract VOPRegistry is IVOPRegistry {
    address public owner;
    address public override vaultAddress;
    uint256 public override registrationFee = 0.003 ether;
    uint256 public override vopCount;
    
    uint256 public constant MAX_VOP_ID = type(uint32).max;

    struct VOPInfo {
        IVOP implementation;
        bool isRegistered;
        bool isVerified;
        bool isPureSensing; 
        bytes32 auditorUID;
        bytes32 bytecodeHash; // Spec v1.21: keccak256 of the contract runtime code
    }

    mapping(uint256 => VOPInfo) private _vops;
    mapping(address => bool) private _isRegistered;
    mapping(bytes32 => bool) private _bytecodeRegistered; // Spec v1.21 uniqueness check

    constructor(address _vault) {
        owner = msg.sender;
        vaultAddress = _vault;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner, "OnlyOwner");
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
     * Must be called by the owner.
     * Spec v1.21: Enforces Bytecode Fingerprinting to prevent proxy ID farming.
     */
    function registerVOP(address vop) external payable override onlyOwner returns (uint256 vopId) {
        require(msg.value >= registrationFee, "InsufficientFee");
        require(vop != address(0), "InvalidAddress");
        require(!_isRegistered[vop], "AlreadyRegistered");
        require(vopCount < MAX_VOP_ID, "RegistryExhausted");

        // 1. Calculate bytecode fingerprint
        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(vop)
        }
        require(codeHash != bytes32(0), "NoCodeAtAddress");
        require(!_bytecodeRegistered[codeHash], "LogicAlreadyRegistered");

        vopId = ++vopCount;
        _vops[vopId] = VOPInfo({
            implementation: IVOP(vop),
            isRegistered: true,
            isVerified: false,
            isPureSensing: false,
            auditorUID: bytes32(0),
            bytecodeHash: codeHash
        });
        
        _isRegistered[vop] = true;
        _bytecodeRegistered[codeHash] = true;

        emit VOPRegistered(vopId, vop);
    }

    /**
     * @notice Admin method to verify and classify a VOP.
     */
    function setVOPStatus(
        uint256 vopId, 
        bool verified, 
        bool pureSensing, 
        bytes32 auditorUID
    ) external onlyOwner {
        require(_vops[vopId].isRegistered, "UnknownVOP");
        _vops[vopId].isVerified = verified;
        _vops[vopId].isPureSensing = pureSensing;
        _vops[vopId].auditorUID = auditorUID;
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

    function getBytecodeHash(uint256 vopId) external view returns (bytes32) {
        return _vops[vopId].bytecodeHash;
    }

    function setRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
    }

    function setVaultAddress(address _newVault) external onlyOwner {
        require(_newVault != address(0), "InvalidAddress");
        address oldVault = vaultAddress;
        vaultAddress = _newVault;
        emit VaultUpdated(oldVault, _newVault);
    }

    function withdraw() external {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(vaultAddress).call{value: balance}("");
        require(success, "WithdrawFailed");
    }
}
