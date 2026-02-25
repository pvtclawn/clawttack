// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import {ContextualLinguisticParser} from "../src/libraries/ContextualLinguisticParser.sol";

/// @dev Wrapper to expose internal library functions for testing.
contract ParserHarness {
    using ContextualLinguisticParser for *;

    function verifyAll(string calldata narrative, ContextualLinguisticParser.Constraints memory c) external pure {
        ContextualLinguisticParser.verifyAll(narrative, c);
    }

    function wouldPassAll(string calldata narrative, ContextualLinguisticParser.Constraints memory c)
        external pure returns (ContextualLinguisticParser.Results memory)
    {
        return ContextualLinguisticParser.wouldPassAll(narrative, c);
    }
}

contract ContextualLinguisticParserTest is Test {
    ParserHarness parser;

    // A valid 80-char narrative with "seven" as target, no poison
    string constant BASE = "The warrior drew seven swords from the ancient stone and prepared for the duel.";
    // 80 chars ✓

    function setUp() public {
        parser = new ParserHarness();
    }

    // ─── Basic constraints (target + poison only, no context) ────────────────

    function test_passesWithTargetOnly() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnMissingTarget() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "dragon";
        c.poisonWord = "xyz";
        vm.expectRevert(ContextualLinguisticParser.TargetWordMissing.selector);
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnPoisonDetected() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "stone";
        vm.expectRevert(ContextualLinguisticParser.PoisonWordDetected.selector);
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnTooShort() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "hi";
        c.poisonWord = "xyz";
        vm.expectRevert(ContextualLinguisticParser.NarrativeTooShort.selector);
        parser.verifyAll("hi there", c);
    }

    function test_revertsOnNonAscii() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "test";
        c.poisonWord = "xyz";
        // Build a 64+ char string with a non-ASCII byte injected via assembly
        bytes memory bad = bytes("The test of the warrior began in the ancient hall where the flames burn brightly.");
        bad[67] = 0xC0; // inject non-ASCII
        vm.expectRevert(ContextualLinguisticParser.InvalidASCII.selector);
        parser.verifyAll(string(bad), c);
    }

    // ─── Target word boundary checks ─────────────────────────────────────────

    function test_targetWordBoundary_standalone() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "cat";
        c.poisonWord = "xyz";
        string memory n = "The cat sat on the mat and watched the birds fly over the garden wall slowly now.";
        parser.verifyAll(n, c);
    }

    function test_targetWordBoundary_insideWord() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "cat";
        c.poisonWord = "xyz";
        // "concatenate" contains "cat" but not at word boundary
        string memory n = "They would concatenate the strings together in a process that took many long hours today.";
        vm.expectRevert(ContextualLinguisticParser.TargetWordMissing.selector);
        parser.verifyAll(n, c);
    }

    // ─── Mandatory quote constraint ──────────────────────────────────────────

    function test_passesWithQuoteMidText() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "ancient stone";
        c.hasQuoteConstraint = true;
        // "ancient stone" appears mid-text in BASE
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnMissingQuote() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "missing phrase";
        c.hasQuoteConstraint = true;
        vm.expectRevert(ContextualLinguisticParser.MandatoryQuoteMissing.selector);
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnQuoteAtStart() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "warrior";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "The warr"; // at position 0 (< QUOTE_EDGE_MARGIN=8)
        c.hasQuoteConstraint = true;
        vm.expectRevert(ContextualLinguisticParser.QuoteAtEdge.selector);
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnQuoteAtEnd() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "the duel."; // at end, within margin
        c.hasQuoteConstraint = true;
        vm.expectRevert(ContextualLinguisticParser.QuoteAtEdge.selector);
        parser.verifyAll(BASE, c);
    }

    function test_noQuoteConstraintOnTurnZero() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.hasQuoteConstraint = false; // turn 0
        parser.verifyAll(BASE, c);
    }

    // ─── Positional letter constraint ────────────────────────────────────────

    function test_passesPositionalLetter() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4; // 'w' in "warrior"
        c.requiredLetter = "w";
        parser.verifyAll(BASE, c);
    }

    function test_revertsOnWrongPositionalLetter() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4;
        c.requiredLetter = "z"; // wrong
        vm.expectRevert(ContextualLinguisticParser.PositionalLetterMismatch.selector);
        parser.verifyAll(BASE, c);
    }

    function test_positionalIsCaseInsensitive() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.hasPositionalConstraint = true;
        c.constrainedPos = 0; // 'T' in "The" → lowered = 't'
        c.requiredLetter = "t";
        parser.verifyAll(BASE, c);
    }

    // ─── All constraints active simultaneously ───────────────────────────────

    function test_allConstraintsPass() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "ancient stone";
        c.hasQuoteConstraint = true;
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4;  // 'w'
        c.requiredLetter = "w";
        parser.verifyAll(BASE, c);
    }

    function test_allConstraints_failOnPoison() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "stone"; // present in BASE
        c.mandatoryQuote = "ancient stone";
        c.hasQuoteConstraint = true;
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4;
        c.requiredLetter = "w";
        vm.expectRevert(ContextualLinguisticParser.PoisonWordDetected.selector);
        parser.verifyAll(BASE, c);
    }

    // ─── wouldPassAll dry-run ────────────────────────────────────────────────

    function test_wouldPassAll_allGood() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "ancient stone";
        c.hasQuoteConstraint = true;
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4;
        c.requiredLetter = "w";

        ContextualLinguisticParser.Results memory r = parser.wouldPassAll(BASE, c);
        assertTrue(r.passesTarget);
        assertTrue(r.passesPoison);
        assertTrue(r.passesQuote);
        assertTrue(r.passesQuotePosition);
        assertTrue(r.passesPositional);
        assertTrue(r.passesAscii);
        assertTrue(r.passesLength);
    }

    function test_wouldPassAll_multipleFailures() public view {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "dragon"; // missing
        c.poisonWord = "stone";  // present
        c.mandatoryQuote = "nonexistent";
        c.hasQuoteConstraint = true;
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4;
        c.requiredLetter = "z"; // wrong

        ContextualLinguisticParser.Results memory r = parser.wouldPassAll(BASE, c);
        assertFalse(r.passesTarget);
        assertFalse(r.passesPoison);
        assertFalse(r.passesQuote);
        assertFalse(r.passesPositional);
        assertTrue(r.passesAscii);
        assertTrue(r.passesLength);
    }

    // ─── Gas benchmark ───────────────────────────────────────────────────────

    function test_gasBenchmark_allConstraints() public {
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "ancient stone";
        c.hasQuoteConstraint = true;
        c.hasPositionalConstraint = true;
        c.constrainedPos = 4;
        c.requiredLetter = "w";

        uint256 gasBefore = gasleft();
        parser.verifyAll(BASE, c);
        uint256 gasUsed = gasBefore - gasleft();
        
        // Log gas for visibility
        emit log_named_uint("Gas used (all constraints, 80 chars)", gasUsed);
        
        // Should be well under 200K
        assertLt(gasUsed, 200_000, "Gas too high");
    }

    function test_gasBenchmark_maxLength() public {
        // 256-char narrative with all constraints
        string memory long = "The seven warriors gathered beneath the ancient stone archway where legends say the first battle was fought between rival clans who sought dominion over the sacred mountain pass and its hidden treasures that lay within the deep caverns below them all.";
        
        ContextualLinguisticParser.Constraints memory c;
        c.targetWord = "seven";
        c.poisonWord = "xyz";
        c.mandatoryQuote = "ancient stone archway";
        c.hasQuoteConstraint = true;
        c.hasPositionalConstraint = true;
        c.constrainedPos = 28;
        c.requiredLetter = "b"; // "beneath" starts at pos 28
        
        uint256 gasBefore = gasleft();
        parser.verifyAll(long, c);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used (all constraints, 256 chars)", gasUsed);
        assertLt(gasUsed, 300_000, "Gas too high for max length");
    }
}
