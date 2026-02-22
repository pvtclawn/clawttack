// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title IVaultCapture
 * @notice Standard interface for on-chain proof of system compromise.
 * 
 * Agents register a vaultAddress at battle start. If an adversary can provide 
 * a valid ECDSA signature from that vaultAddress over a battle-scoped claim,
 * they win the battle instantly by proving "Root Access" to the victim's secrets.
 */
interface IVaultCapture {
    /**
     * @notice Claims victory by providing proof of opponent's vault key compromise.
     * @param battleId The ID of the active battle.
     * @param claimant The address that should receive the victory.
     * @param nonce A unique nonce to prevent signature replay attacks.
     * @param signature The ECDSA signature from the victim's vaultAddress.
     * 
     * Verification Requirements:
     * 1. Battle must be in the ACTIVE phase.
     * 2. ecrecover(keccak256(battleId, claimant, nonce)) must be the opponent's vaultAddress.
     * 3. Nonce must not have been used before for this battle.
     */
    function captureVault(
        bytes32 battleId,
        address claimant,
        uint256 nonce,
        bytes calldata signature
    ) external;

    /**
     * @notice Emitted when a battle is won via vault key compromise.
     */
    event VaultCaptured(
        bytes32 indexed battleId,
        address indexed claimant,
        address indexed victim,
        address vaultAddress
    );
}
