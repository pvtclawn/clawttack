// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import {LinguisticParser} from "../src/libraries/LinguisticParser.sol";
import {ClawttackErrors} from "../src/libraries/ClawttackErrors.sol";

contract LinguisticParserHarness {
    function verifyLinguistics(string memory narrative, string memory targetWord, string memory poisonWord) external pure {
        LinguisticParser.verifyLinguistics(narrative, targetWord, poisonWord);
    }
}

contract LinguisticParserTest is Test {
    LinguisticParserHarness harness;

    function setUp() public {
        harness = new LinguisticParserHarness();
    }

    // --- Boundary Validations (Target Word) ---
    function test_TargetWord_CleanMatch() public {
        // Target is "apple"
        harness.verifyLinguistics(
            "I ate an apple today because it was good and long enough to pass.",
            "apple",
            "poison"
        );
    }

    function test_TargetWord_StartOfNarrative() public {
        harness.verifyLinguistics(
            "Apple is what I ate today because it was good and long enough to pass.",
            "apple",
            "poison"
        );
    }

    function test_TargetWord_EndOfNarrative() public {
        harness.verifyLinguistics(
            "This narrative is long enough to pass and at the very end is an apple",
            "apple",
            "poison"
        );
    }

    function test_TargetWord_PunctuationBoundaries() public {
        harness.verifyLinguistics(
            "I ate an:apple, today because it was good and long enough to pass.",
            "apple",
            "poison"
        );
    }

    function test_TargetWord_CaseInsensitive() public {
        harness.verifyLinguistics(
            "I ate an ApPlE today because it was good and long enough to pass.",
            "apple",
            "poison"
        );
    }

    // --- Boundary Validations (Substring Fails) ---
    function test_Revert_Target_SubstringPrefix() public {
        vm.expectRevert(ClawttackErrors.TargetWordMissing.selector);
        // Target is "apple", word is "apples"
        harness.verifyLinguistics(
            "I ate some apples today because it was good and long enough to pass.",
            "apple",
            "poison"
        );
    }

    function test_Revert_Target_SubstringSuffix() public {
        vm.expectRevert(ClawttackErrors.TargetWordMissing.selector);
        // Target is "apple", word is "pineapple"
        harness.verifyLinguistics(
            "I ate a pineapple today because it was good and long enough to pass.",
            "apple",
            "poison"
        );
    }

    // --- Poison Validations (Substring Match Defaults to Fail) ---
    function test_Revert_Poison_CleanMatch() public {
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        harness.verifyLinguistics(
            "This contains the poison word inside it. Long enough string here.",
            "apple",
            "poison"
        );
    }

    function test_Revert_Poison_SubstringMatch() public {
        // V3 Mechanics change: Poison words evaluate on direct substring match (no boundary check needed)
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        // Poison is "poi", word is "poison"
        harness.verifyLinguistics(
            "This contains the poison word inside it. Long enough string here.",
            "apple",
            "poi"
        );
    }

    function test_Revert_Poison_CaseInsensitive() public {
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        harness.verifyLinguistics(
            "This contains the pOiSoN word inside it. Long enough string here.",
            "apple",
            "poison"
        );
    }

    // --- Edge Cases ---
    function test_Revert_ASCII_Violation() public {
        vm.expectRevert(ClawttackErrors.InvalidASCII.selector);
        harness.verifyLinguistics(
            string(abi.encodePacked("This contains a non-ascii character ", bytes1(0xFF), ". Long enough string here to pass.")),
            "apple",
            "poison"
        );
    }

    function test_Revert_NarrativeTooShort() public {
        vm.expectRevert(ClawttackErrors.NarrativeTooShort.selector);
        harness.verifyLinguistics(
            "Too short.",
            "apple",
            "poison"
        );
    }

    // --- ContainsSubstring Helper ---
    function test_ContainsSubstring() public {
        assertTrue(LinguisticParser.containsSubstring("hello world", "world"));
        assertTrue(LinguisticParser.containsSubstring("hello world", "WORLD"));
        assertTrue(LinguisticParser.containsSubstring("hello world", "lo w"));
        assertTrue(LinguisticParser.containsSubstring("prefix_match", "prefix"));
        assertTrue(LinguisticParser.containsSubstring("match_suffix", "suffix"));

        assertFalse(LinguisticParser.containsSubstring("hello world", "word"));
        assertFalse(LinguisticParser.containsSubstring("match", "longer_match"));
        assertFalse(LinguisticParser.containsSubstring("match", ""));
    }
}
