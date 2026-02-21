// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

// Need math libraries for fixed point operations. Using PRBMath for robust fixed-point arithmetic if available, 
// but for MVP we will use a simplified Glicko-2 integer scaling approach to keep gas costs low.

/**
 * @title Glicko2Math
 * @notice Simplified, scaled integer arithmetic for Glicko-2 matchmaking constraint equations.
 * @dev Scale factor is 10000. For production, consider deploying a full fixed-point math library.
 */
library Glicko2Math {
    uint256 constant SCALE = 10_000;
    uint256 constant DEFAULT_RATING = 1500;
    uint256 constant DEFAULT_RD = 350;
    uint256 constant MIN_RD = 30;

    /**
     * @notice Checks if two agents are within a valid matchmaking window.
     * @param ratingA Agent A's ELO
     * @param rdA Agent A's Rating Deviation
     * @param ratingB Agent B's ELO
     * @param rdB Agent B's Rating Deviation
     * @return True if they overlap, False otherwise.
     */
    function isMatchable(
        uint256 ratingA,
        uint256 rdA,
        uint256 ratingB,
        uint256 rdB
    ) internal pure returns (bool) {
        // Calculate ranges (R +/- 2*RD)
        uint256 minA = ratingA > (2 * rdA) ? ratingA - (2 * rdA) : 0;
        uint256 maxA = ratingA + (2 * rdA);
        
        uint256 minB = ratingB > (2 * rdB) ? ratingB - (2 * rdB) : 0;
        uint256 maxB = ratingB + (2 * rdB);

        // Check for overlap
        return (minA <= maxB) && (minB <= maxA);
    }

    // Note: Full Glicko-2 iteration updates for winning/losing are heavily computationally intensive
    // on EVM and usually require a loop or off-chain computation with on-chain verification.
    // For the MVP, we will implement a simplified ELO update step here.
    
    function updateSimplifiedELO(
        uint256 winnerRating,
        uint256 loserRating,
        uint256 kFactor
    ) internal pure returns (uint256 newWinnerRating, uint256 newLoserRating) {
        // Simplified ELO update for MVP.
        // Expected score E_A = 1 / (1 + 10^((R_B - R_A)/400))
        // Simulated using scaled integers.
        
        // If winner > loser, gain is smaller. If winner < loser, gain is larger.
        uint256 maxDiff = 400;
        uint256 diff;
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
        // If winner was higher, gain is less than K/2.
        // If winner was lower, gain is more than K/2.
        uint256 baseGain = kFactor / 2;
        uint256 adjustment = (diff * baseGain) / maxDiff;
        
        uint256 gain = winnerHigher ? (baseGain - adjustment) : (baseGain + adjustment);
        
        // Ensure minimum gain of 1
        if (gain == 0) gain = 1;
        
        newWinnerRating = winnerRating + gain;
        // Prevent underflow
        newLoserRating = loserRating > gain ? loserRating - gain : 1;
        
        return (newWinnerRating, newLoserRating);
    }
}
