// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface IClawttackArenaView {
    function wordDictionary() external view returns (address);
    function owner() external view returns (address);
    function protocolFeeRate() external view returns (uint256);
    function MIN_RATED_STAKE() external view returns (uint256);
    function MAX_ELO_DIFF() external view returns (uint32);
    function agents(uint256 agentId)
        external
        view
        returns (address owner, uint32 eloRating, uint32 totalWins, uint32 totalLosses);
    function getRandomVop(uint256 seed) external view returns (address);
    function updateRatings(uint256 battleId, uint256 challengerId, uint256 acceptorId, uint256 winnerId, uint256 loserId, uint256 stake) external;
}
