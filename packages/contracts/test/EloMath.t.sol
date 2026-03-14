// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import "../src/libraries/EloMath.sol";

/**
 * @notice Unit tests for the improved EloMath library.
 *         Expected values computed from the piecewise S-curve formula with
 *         asymmetric K-factors (K_winner, K_loser both = 32 in these tests).
 *
 *  S-curve buckets (E_higher × 1000):
 *    diff=  0: 500  diff= 50: 571  diff=100: 640  diff=150: 703
 *    diff=200: 760  diff=250: 808  diff=300: 849  diff=350: 882
 *    diff>=400 (capped): 882→909 interpolated
 */
contract EloMathTest is Test {
    // ─── Decisive results ─────────────────────────────────────────────────────

    /// Favored winner (diff=200): gains 7, loser drops 7
    function test_updateElo_winnerHigher() public {
        // E(1600 vs 1400) = 760 → gain = floor((32×240)/1000) = 7
        (uint32 newW, uint32 newL) = EloMath.updateElo(1600, 1400, 32, 32);
        assertEq(newW, 1607);
        assertEq(newL, 1393);
    }

    /// Upset winner (diff=200): gains 24, loser drops 24
    function test_updateElo_winnerLower() public {
        // E(underdog) = 240 → gain = floor((32×760)/1000) = 24
        (uint32 newW, uint32 newL) = EloMath.updateElo(1400, 1600, 32, 32);
        assertEq(newW, 1424);
        assertEq(newL, 1576);
    }

    /// Equal opponents: both move by K/2 = 16
    function test_updateElo_equal() public {
        (uint32 newW, uint32 newL) = EloMath.updateElo(1500, 1500, 32, 32);
        assertEq(newW, 1516);
        assertEq(newL, 1484);
    }

    /// Diff>400 is capped at 400. Dominant win earns minimum (3 pts).
    function test_updateElo_maxDiff() public {
        // diff=500 capped to 400, bucket 7+: E_higher=882 → gain=floor((32×118)/1000)=3
        (uint32 newW, uint32 newL) = EloMath.updateElo(2000, 1500, 32, 32);
        assertEq(newW, 2003);
        assertEq(newL, 1497);

        // Underdog beats 500p stronger: gain=floor((32×882)/1000)=28
        (uint32 newW2, uint32 newL2) = EloMath.updateElo(1500, 2000, 32, 32);
        assertEq(newW2, 1528);
        assertEq(newL2, 1972);
    }

    /// Provisional K-factor (K=40) gives larger swings than K=20
    function test_updateElo_provisionalK_swingsMore() public {
        (uint32 wK40, uint32 lK40) = EloMath.updateElo(1500, 1500, 40, 40);
        (uint32 wK10, uint32 lK10) = EloMath.updateElo(1500, 1500, 10, 10);
        assertGt(wK40 - 1500, wK10 - 1500); // K=40 earns more for equal match
    }

    /// Asymmetric K-factors: gains != losses
    function test_updateElo_asymmetric() public {
        // Winner K=40 (new), Loser K=10 (elite) — not zero-sum
        (uint32 newW, uint32 newL) = EloMath.updateElo(1500, 1500, 40, 10);
        assertGt(newW - 1500, 1500 - newL); // winner gains more than loser drops
    }

    /// Floor: minimum gain is always 1 even for massive upsets
    function test_updateElo_minimumGainFloor() public {
        // Near-max dominant: K=10. gain = floor((10×118)/1000) = 1
        (uint32 newW,) = EloMath.updateElo(2000, 1500, 10, 10);
        assertGe(newW, 2001); // at least 1 point gained
    }


    // ─── kFactor tier boundaries ──────────────────────────────────────────────

    function test_kFactor_provisional() public {
        assertEq(EloMath.kFactor(0),  40); // brand new
        assertEq(EloMath.kFactor(9),  40); // still provisional
    }

    function test_kFactor_established() public {
        assertEq(EloMath.kFactor(10), 20);
        assertEq(EloMath.kFactor(29), 20);
    }

    function test_kFactor_elite() public {
        assertEq(EloMath.kFactor(30), 10);
        assertEq(EloMath.kFactor(999), 10);
    }
}
