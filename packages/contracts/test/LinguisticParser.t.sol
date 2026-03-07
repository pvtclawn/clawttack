// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {LinguisticParser} from "../src/libraries/LinguisticParser.sol";
import {ClawttackErrors} from "../src/libraries/ClawttackErrors.sol";

/// @dev External wrapper so we can use vm.expectRevert on internal library calls
contract LinguisticParserWrapper {
    function verify(string calldata narrative, string calldata target, string calldata poison) external pure {
        LinguisticParser.verifyLinguistics(narrative, target, poison);
    }

    function wouldPass(string calldata narrative, string calldata target, string calldata poison)
        external pure returns (bool passesTarget, bool passesPoison, bool passesLength, bool passesAscii)
    {
        return LinguisticParser.wouldPass(narrative, target, poison);
    }
}

/// @title Poison Boundary Tests
/// @notice Validates that poison detection uses word boundaries (matching target behavior).
/// @dev Regression tests for the P0 substring exploit (2026-02-24).
contract LinguisticParserTest is Test {
    LinguisticParserWrapper wrapper;

    function setUp() public {
        wrapper = new LinguisticParserWrapper();
    }

    // Helper: pad narrative to ≥64 chars
    function _pad(string memory s) internal pure returns (string memory) {
        return string.concat(s, ". This is padding to meet the sixty four char minimum length!");
    }

    // ─── Poison boundary: standalone word SHOULD be detected ─────────────────

    function test_poisonDetected_standaloneWord() public {
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of watching the cat sit by the window on a sunny day"),
            "art",
            "cat"
        );
    }

    function test_poisonDetected_startOfString() public {
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("Cat lovers enjoy the art of feeding their pets every morning"),
            "art",
            "cat"
        );
    }

    function test_poisonDetected_endOfNarrative() public {
        // "cat" at the very end (before padding hits, but still a standalone word)
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("She studied the art of taming a wild cat"),
            "art",
            "cat"
        );
    }

    function test_poisonDetected_withPunctuation() public {
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art display showed a cat, a dog, and a fish in the gallery"),
            "art",
            "cat"
        );
    }

    // ─── Poison boundary: substring inside another word should NOT trigger ───

    function test_poisonDetected_substringInWord() public {
        // "cat" inside "concatenate" SHOULD trigger poison
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of concatenating strings is fundamental to programming"),
            "art",
            "cat"
        );
    }

    function test_poisonDetected_substringInMiddle() public {
        // "cat" inside "education" SHOULD trigger poison
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of education transforms societies and builds knowledge"),
            "art",
            "cat"
        );
    }

    function test_poisonDetected_substringAtEnd() public {
        // "cat" inside "wildcat" SHOULD trigger 
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art museum displayed wildcat imagery from the world above"),
            "art",
            "cat"
        );
    }

    // ─── Short poison words (the critical exploit case) ──────────────────────

    function test_poisonDetected_twoCharSubstring_er() public {
        // "er" inside "water", "other", "every" SHOULD trigger
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of watercolors brings every style to a totally new level"),
            "art",
            "er"
        );
    }

    function test_poisonDetected_twoCharSubstring_in() public {
        // "in" inside "using", "finding", "beginning" SHOULD trigger
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of finding beauty using simple methods was the beginning"),
            "art",
            "in"
        );
    }

    function test_poisonDetected_twoCharSubstring_an() public {
        // "an" inside "ancient", "began", "plan" SHOULD trigger
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of planning began with methods and beautiful traditions"),
            "art",
            "an"
        );
    }

    function test_poisonDetected_twoCharStandalone_in() public {
        // "in" as a standalone word SHOULD trigger
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art is displayed in the gallery for all to see and enjoy"),
            "art",
            "in"
        );
    }

    function test_poisonDetected_twoCharStandalone_an() public {
        // "an" as a standalone word SHOULD trigger
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art was truly an impressive display of skill and beauty"),
            "art",
            "an"
        );
    }

    // ─── wouldPass view function consistency ─────────────────────────────────

    function test_wouldPass_poisonSubstringIsDetected() public {
        (bool passesTarget, bool passesPoison,,) =
            wrapper.wouldPass(
                _pad("The art of concatenating values is a programming fundamental"),
                "art",
                "cat"
            );
        assertTrue(passesTarget, "target should pass");
        assertFalse(passesPoison, "poison substring should be detected");
    }

    function test_wouldPass_poisonStandaloneDetected() public {
        (bool passesTarget, bool passesPoison,,) =
            wrapper.wouldPass(
                _pad("The art of watching the cat sit by the window on a sunny day"),
                "art",
                "cat"
            );
        assertTrue(passesTarget, "target should pass");
        assertFalse(passesPoison, "poison standalone should be detected");
    }

    // ─── Case insensitive poison boundary ────────────────────────────────────

    function test_poisonDetected_caseInsensitive() public {
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art collector saw a CAT running through the exhibit hall"),
            "art",
            "cat"
        );
    }

    function test_poisonDetected_caseInsensitiveSubstring() public {
        // "CAT" inside "CONCATENATION" SHOULD trigger
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        wrapper.verify(
            _pad("The art of CONCATENATION helps build complex systems quickly"),
            "art",
            "cat"
        );
    }
}
