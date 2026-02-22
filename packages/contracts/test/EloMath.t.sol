// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import "../src/libraries/EloMath.sol";

contract EloMathTest is Test {
    function test_updateElo_winnerHigher() public {
        (uint256 newW, uint256 newL) = EloMath.updateElo(1600, 1400, 32);
        assertEq(newW, 1608);
        assertEq(newL, 1392);
    }

    function test_updateElo_winnerLower() public {
        (uint256 newW, uint256 newL) = EloMath.updateElo(1400, 1600, 32);
        assertEq(newW, 1424);
        assertEq(newL, 1576);
    }

    function test_updateElo_equal() public {
        (uint256 newW, uint256 newL) = EloMath.updateElo(1500, 1500, 32);
        assertEq(newW, 1516);
        assertEq(newL, 1484);
    }

    function test_updateElo_maxDiff() public {
        (uint256 newW, uint256 newL) = EloMath.updateElo(2000, 1500, 32);
        assertEq(newW, 2001);
        assertEq(newL, 1499);

        (uint256 newW2, uint256 newL2) = EloMath.updateElo(1500, 2000, 32);
        assertEq(newW2, 1532);
        assertEq(newL2, 1968);
    }
}
