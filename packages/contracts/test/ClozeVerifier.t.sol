// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClozeVerifier.sol";

contract ClozeWrapper {
    function verifyBlank(bytes memory narrative) external pure returns (uint256) {
        return ClozeVerifier.verifyBlank(narrative);
    }
    function reconstruct(bytes memory narrative, uint256 offset, bytes memory word) external pure returns (bytes memory) {
        return ClozeVerifier.reconstruct(narrative, offset, word);
    }
}

contract ClozeVerifierTest is Test {
    using ClozeVerifier for bytes;
    ClozeWrapper wrapper;

    function setUp() public {
        wrapper = new ClozeWrapper();
    }

    function test_verifyBlank_findsMarker() public pure {
        bytes memory narrative = "The knight [BLANK]ed his quest when the dragon appeared";
        uint256 offset = ClozeVerifier.verifyBlank(narrative);
        assertEq(offset, 11); // "[BLANK]" starts at byte 11
    }

    function test_verifyBlank_atStart() public pure {
        bytes memory narrative = "[BLANK] is a powerful concept in combat";
        uint256 offset = ClozeVerifier.verifyBlank(narrative);
        assertEq(offset, 0);
    }

    function test_verifyBlank_atEnd() public pure {
        bytes memory narrative = "The warrior chose to [BLANK]";
        uint256 offset = ClozeVerifier.verifyBlank(narrative);
        assertEq(offset, 21);
    }

    function test_verifyBlank_revert_notFound() public {
        bytes memory narrative = "No blank marker here at all just regular text";
        vm.expectRevert(ClozeVerifier.BlankNotFound.selector);
        wrapper.verifyBlank(narrative);
    }

    function test_verifyBlank_revert_multipleFound() public {
        bytes memory narrative = "First [BLANK] and second [BLANK] are too many";
        vm.expectRevert(ClozeVerifier.MultipleBlankFound.selector);
        wrapper.verifyBlank(narrative);
    }

    function test_reconstruct_middle() public pure {
        bytes memory narrative = "The knight [BLANK]ed his quest";
        bytes memory word = "abandon";
        bytes memory original = ClozeVerifier.reconstruct(narrative, 11, word);
        assertEq(string(original), "The knight abandoned his quest");
    }

    function test_reconstruct_start() public pure {
        bytes memory narrative = "[BLANK] is everything";
        bytes memory word = "ability";
        bytes memory original = ClozeVerifier.reconstruct(narrative, 0, word);
        assertEq(string(original), "ability is everything");
    }

    function test_reconstruct_end() public pure {
        bytes memory narrative = "Choose to [BLANK]";
        bytes memory word = "absorb";
        bytes memory original = ClozeVerifier.reconstruct(narrative, 10, word);
        assertEq(string(original), "Choose to absorb");
    }

    function test_verifyReveal_valid() public pure {
        bytes memory narrative = "The [BLANK] was fierce";
        bool valid = ClozeVerifier.verifyReveal(narrative, "battle", 4);
        assertTrue(valid);
    }

    function test_verifyReveal_wrongOffset() public pure {
        bytes memory narrative = "The [BLANK] was fierce";
        bool valid = ClozeVerifier.verifyReveal(narrative, "battle", 0);
        assertFalse(valid);
    }

    function test_verifyReveal_outOfBounds() public pure {
        bytes memory narrative = "Short [BLANK]";
        bool valid = ClozeVerifier.verifyReveal(narrative, "word", 100);
        assertFalse(valid);
    }

    function test_gasEstimate_verifyBlank() public {
        bytes memory narrative = "The ancient warrior decided to [BLANK] the sacred artifact before the enemy could seize control of the realm forever";
        uint256 gasBefore = gasleft();
        ClozeVerifier.verifyBlank(narrative);
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("verifyBlank gas", gasUsed);
        assertLt(gasUsed, 50000, "verifyBlank should be under 50K gas");
    }

    function test_gasEstimate_reconstruct() public {
        bytes memory narrative = "The ancient warrior decided to [BLANK] the sacred artifact before the enemy could seize control";
        uint256 gasBefore = gasleft();
        ClozeVerifier.reconstruct(narrative, 31, "abandon");
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("reconstruct gas", gasUsed);
        assertLt(gasUsed, 40000, "reconstruct should be under 40K gas");
    }
}
