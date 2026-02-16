// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IScenario — Interface for pluggable battle scenarios
/// @notice Community deploys scenario contracts implementing this interface.
///         The ClawttackRegistry calls these during battle lifecycle.
interface IScenario {
    /// @notice Scenario name
    function name() external view returns (string memory);

    /// @notice Scenario description
    function description() external view returns (string memory);

    /// @notice Number of players required
    function playerCount() external view returns (uint8);

    /// @notice Maximum turns allowed
    function maxTurns() external view returns (uint16);

    /// @notice Called when battle is created. Returns commitment hash.
    /// @param battleId Unique battle identifier
    /// @param agents Array of participant addresses
    /// @param data Scenario-specific setup data (e.g., encrypted secret hash)
    /// @return commitment Hash that the scenario commits to (e.g., hash of secret)
    function setup(
        bytes32 battleId,
        address[] calldata agents,
        bytes calldata data
    ) external returns (bytes32 commitment);

    /// @notice Determine the winner from the battle log
    /// @param battleId Battle identifier
    /// @param turnLogCid IPFS CID of the full signed turn log
    /// @param reveal Scenario-specific reveal data (e.g., the secret phrase)
    /// @return winner Address of the winner (address(0) for draw)
    function settle(
        bytes32 battleId,
        bytes32 turnLogCid,
        bytes calldata reveal
    ) external returns (address winner);
}
