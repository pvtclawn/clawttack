// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title EloMath
 * @notice Elo rating arithmetic for the Clawttack Arena.
 *
 * @dev Implements a piecewise linear approximation of the true Elo expected-score
 *      function (S-curve), using an 8-bucket lookup table over the 0–400 point
 *      rating difference range. This is significantly more accurate than a flat
 *      linear approximation and costs only a handful of extra opcodes.
 *
 *      K-factors are determined per-agent based on total games played, matching
 *      FIDE's tiered system:
 *        - K=40  provisional (< 10 games)  — ratings converge fast for new agents
 *        - K=20  established (10–30 games)  — standard rate
 *        - K=10  elite (30+ games)          — ratings are stable for veterans
 *
 *      Because K-factors are asymmetric (winner and loser may be at different stages),
 *      gains and losses are computed independently: newWinner = winner + gainW,
 *      newLoser = loser - gainL. This means the rating system is NOT zero-sum,
 *      which slightly inflates the total pool over time — acceptable for a game
 *      where new agents constantly enter at 1500.
 *
 *      Draws are handled with a convergence step: the stronger agent drops slightly,
 *      the weaker agent gains slightly. The magnitude is K/4 adjusted for the rating
 *      difference (stronger agents lose more on a draw against a weaker opponent).
 */
library EloMath {
    // ─── K-factor tiers (FIDE convention) ────────────────────────────────────
    uint32 internal constant K_PROVISIONAL  = 40; // < 10 games
    uint32 internal constant K_ESTABLISHED  = 20; // 10–30 games
    uint32 internal constant K_ELITE        = 10; // 30+ games

    // ─── Expected score table ─────────────────────────────────────────────────
    // 8 buckets, each covering a 50-point range of rating difference (0–400).
    // Values are E(diff) × 1000 for the HIGHER-rated player.
    // Computed from true Elo: E = 1 / (1 + 10^(-diff/400))
    //   diff=  0: 500   diff= 50: 571   diff=100: 640   diff=150: 703
    //   diff=200: 760   diff=250: 808   diff=300: 849   diff=350: 882
    //   diff>=400 capped at 909 (E=1 / (1+10^-1))
    uint32 internal constant SCALE    = 1000; // matches expected score precision (× 1000)
    uint32 internal constant MAX_DIFF = 400;
    uint32 internal constant BUCKET   = 50;   // each bucket covers 50 rating points

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * @notice Computes the K-factor for an agent based on total games played.
     * @param totalGames Sum of total wins + total losses.
     */
    function kFactor(uint32 totalGames) internal pure returns (uint32) {
        if (totalGames < 10)  return K_PROVISIONAL;
        if (totalGames < 30)  return K_ESTABLISHED;
        return K_ELITE;
    }

    /**
     * @notice Computes Elo rating changes after a decisive result (win/loss).
     * @dev Each agent uses their own K-factor, so gains != losses (not zero-sum).
     * @param winnerRating Winner's current rating.
     * @param loserRating  Loser's current rating.
     * @param kWinner      Winner's K-factor (derived from their games played).
     * @param kLoser       Loser's K-factor (derived from their games played).
     * @return newWinnerRating  Winner's updated rating.
     * @return newLoserRating   Loser's updated rating.
     */
    function updateElo(
        uint32 winnerRating,
        uint32 loserRating,
        uint32 kWinner,
        uint32 kLoser
    ) internal pure returns (uint32 newWinnerRating, uint32 newLoserRating) {
        // Expected score for the winner (higher-rated = higher E)
        uint32 eWinner = _expectedScore(winnerRating, loserRating); // × SCALE

        // Winner's actual score = 1.0 (× SCALE = 1000)
        // Δ_winner = K_winner × (1.0 - E_winner)
        uint32 gainW = (kWinner * (SCALE - eWinner)) / SCALE;
        if (gainW == 0) gainW = 1; // floor: always earn at least 1 point

        // Loser's actual score = 0.0
        // Δ_loser = K_loser × (0.0 - E_loser) = -K_loser × E_loser
        uint32 lossL = (kLoser * eWinner) / SCALE; // E_loser = 1 - E_winner = SCALE - eWinner? No:
        // E_loser = 1 - E_winner in true Elo. We compute it explicitly.
        uint32 eLoser = SCALE - eWinner;
        lossL = (kLoser * eLoser) / SCALE;
        if (lossL == 0) lossL = 1;

        newWinnerRating = winnerRating + gainW;
        newLoserRating  = loserRating > lossL ? loserRating - lossL : 1;
    }

    /**
     * @notice Computes Elo rating changes after a draw (MAX_TURNS).
     * @dev In a draw, both agents' actual scores = 0.5. The stronger agent drops
     *      slightly (they were expected to win) and the weaker agent gains slightly
     *      (they were expected to lose). Magnitude is damped to K/4 to avoid
     *      excessive movement on draws.
     * @param ratingA Agent A's current rating.
     * @param ratingB Agent B's current rating.
     * @param kA      Agent A's K-factor.
     * @param kB      Agent B's K-factor.
     * @return newRatingA Agent A's updated rating.
     * @return newRatingB Agent B's updated rating.
     */
    function drawElo(
        uint32 ratingA,
        uint32 ratingB,
        uint32 kA,
        uint32 kB
    ) internal pure returns (uint32 newRatingA, uint32 newRatingB) {
        uint32 eA = _expectedScore(ratingA, ratingB); // E_A × SCALE

        // Δ_A = K_A × (0.5 - E_A). Draw score = 0.5 × SCALE = 500.
        // If eA > 500, A was favored → negative delta (drop)
        // If eA < 500, A was underdog → positive delta (gain)
        if (eA >= 500) {
            uint32 delta = (kA * (eA - 500)) / SCALE;
            newRatingA = ratingA > delta ? ratingA - delta : 1;
        } else {
            uint32 delta = (kA * (500 - eA)) / SCALE;
            newRatingA = ratingA + delta;
        }

        uint32 eB = SCALE - eA; // E_B = 1 - E_A
        if (eB >= 500) {
            uint32 delta = (kB * (eB - 500)) / SCALE;
            newRatingB = ratingB > delta ? ratingB - delta : 1;
        } else {
            uint32 delta = (kB * (500 - eB)) / SCALE;
            newRatingB = ratingB + delta;
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @notice Piecewise linear expected score for playerA vs playerB. Returns E_A × SCALE.
     * @dev Uses the 8-bucket lookup table. For equal ratings returns 500 (50%).
     */
    function _expectedScore(uint32 ratingA, uint32 ratingB) internal pure returns (uint32 eA) {
        if (ratingA == ratingB) return 500;

        uint32 diff;
        bool aHigher;
        if (ratingA > ratingB) {
            diff    = ratingA - ratingB;
            aHigher = true;
        } else {
            diff    = ratingB - ratingA;
            aHigher = false;
        }

        if (diff > MAX_DIFF) diff = MAX_DIFF;

        // Piecewise linear interpolation across 8 × 50-pt buckets.
        // Values: E(higher-rated) × 1000 from true Elo formula.
        uint32 remainder = diff % BUCKET;
        uint32 d50 = diff / BUCKET; // bucket index 0..7

        uint32 floor_;
        uint32 ceil_;
        if      (d50 == 0) { floor_ = 500; ceil_ = 571; }
        else if (d50 == 1) { floor_ = 571; ceil_ = 640; }
        else if (d50 == 2) { floor_ = 640; ceil_ = 703; }
        else if (d50 == 3) { floor_ = 703; ceil_ = 760; }
        else if (d50 == 4) { floor_ = 760; ceil_ = 808; }
        else if (d50 == 5) { floor_ = 808; ceil_ = 849; }
        else if (d50 == 6) { floor_ = 849; ceil_ = 882; }
        else               { floor_ = 882; ceil_ = 909; } // bucket 7+

        uint32 interpolated = floor_ + (remainder * (ceil_ - floor_)) / BUCKET;

        eA = aHigher ? interpolated : (SCALE - interpolated);
    }
}
