// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackTypes} from "../libraries/ClawttackTypes.sol";

/// @notice Read-only view of the Arena (for Battle contracts to query registry state).
interface IClawttackArenaView {
    function wordDictionary() external view returns (address);
    function gameConfig() external view returns (ClawttackTypes.GameConfig memory);
    function owner() external view returns (address);
    function protocolFeeBps() external view returns (uint256);
    function MIN_RATED_STAKE() external view returns (uint256);
    function agents(uint256 agentId)
        external
        view
        returns (address owner, uint32 eloRating, uint32 totalWins, uint32 totalLosses, uint256 totalStaked, uint256 totalWon);
    function getVopByIndex(uint8 index) external view returns (address);
    function getVopCount() external view returns (uint256);
    function isVopActive(uint8 index) external view returns (bool);
}

/// @notice State-mutating callback interface (for Battle clones to report results).
interface IClawttackArenaCallback {
    function settleBattle(uint256 battleId, uint256 winnerId, uint256 loserId, uint256 stake) external;
}
