// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

// Uses a simplified Glicko-inspired integer scaling approach specifically optimized to keep L2 gas costs intrinsically low.

/**
 * @title EloMath
 * @notice Simplified, scaled integer arithmetic for Elo matchmaking.
 * @dev Scale factor is 10000. This is optimized for gas efficiency on L2 networks.
 */
library EloMath {
    uint256 constant SCALE = 10_000;
    uint32 constant DEFAULT_RATING = 1500;

    /**
     * @notice Computes a simplified scaled integer Elo update.
     * @param winnerRating Winning agent's Elo
     * @param loserRating Losing agent's Elo
     * @param kFactor The K-Factor scaler parameter determining max point swing
     * @return newWinnerRating The winner's new Elo rating
     * @return newLoserRating The loser's new Elo rating
     */
    function updateElo(uint32 winnerRating, uint32 loserRating, uint32 kFactor)
        internal
        pure
        returns (uint32 newWinnerRating, uint32 newLoserRating)
    {
        // Simplified Elo update optimized for on-chain execution.
        // Expected score E_A = 1 / (1 + 10^((R_B - R_A)/400))
        // Simulated using scaled integers.

        uint32 maxDiff = 400;
        uint32 diff;
        bool winnerHigher;

        if (winnerRating >= loserRating) {
            diff = winnerRating - loserRating;
            winnerHigher = true;
        } else {
            diff = loserRating - winnerRating;
            winnerHigher = false;
        }

        if (diff > maxDiff) diff = maxDiff;

        // Base gain is K/2. Adjust based on difference.
        uint32 baseGain = kFactor / 2;
        uint32 adjustment = (diff * baseGain) / maxDiff;

        uint32 gain = winnerHigher ? (baseGain - adjustment) : (baseGain + adjustment);

        // Ensure minimum gain of 1
        if (gain == 0) gain = 1;

        newWinnerRating = winnerRating + gain;
        // Prevent underflow
        newLoserRating = loserRating > gain ? loserRating - gain : 1;

        return (newWinnerRating, newLoserRating);
    }
}
