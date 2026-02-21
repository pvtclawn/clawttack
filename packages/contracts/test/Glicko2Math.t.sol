// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/libraries/Glicko2Math.sol";

contract Glicko2MathTest is Test {
    function test_isMatchable_overlap() public {
        assertTrue(Glicko2Math.isMatchable(1500, 100, 1700, 50));
    }
    
    function test_isMatchable_noOverlap() public {
        assertFalse(Glicko2Math.isMatchable(1500, 100, 1800, 10));
    }
    
    function test_isMatchable_zeros() public {
        assertTrue(Glicko2Math.isMatchable(0, 0, 0, 0));
    }
    
    function test_isMatchable_rdLargerThanRating() public {
        assertTrue(Glicko2Math.isMatchable(50, 100, 200, 10));
    }
    
    function test_updateSimplifiedELO_winnerHigher() public {
        (uint256 newW, uint256 newL) = Glicko2Math.updateSimplifiedELO(1600, 1400, 32);
        assertEq(newW, 1608);
        assertEq(newL, 1392);
    }
    
    function test_updateSimplifiedELO_winnerLower() public {
        (uint256 newW, uint256 newL) = Glicko2Math.updateSimplifiedELO(1400, 1600, 32);
        assertEq(newW, 1424);
        assertEq(newL, 1576);
    }
    
    function test_updateSimplifiedELO_equal() public {
        (uint256 newW, uint256 newL) = Glicko2Math.updateSimplifiedELO(1500, 1500, 32);
        assertEq(newW, 1516);
        assertEq(newL, 1484);
    }
    
    function test_updateSimplifiedELO_maxDiff() public {
        (uint256 newW, uint256 newL) = Glicko2Math.updateSimplifiedELO(2000, 1500, 32);
        assertEq(newW, 2001);
        assertEq(newL, 1499);
        
        (uint256 newW2, uint256 newL2) = Glicko2Math.updateSimplifiedELO(1500, 2000, 32);
        assertEq(newW2, 1532);
        assertEq(newL2, 1968);
    }
}
