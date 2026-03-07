// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {NccVerifier} from "../src/libraries/NccVerifier.sol";
import {ClawttackTypes} from "../src/libraries/ClawttackTypes.sol";
import {IWordDictionary} from "../src/interfaces/IWordDictionary.sol";

contract MockWordDictionary is IWordDictionary {
    string[] private words;
    constructor() {
        words.push("abandon");  // 0
        words.push("ability");  // 1
        words.push("able");     // 2
        words.push("about");    // 3
    }
    function word(uint16 index) external view override returns (string memory) {
        return words[index];
    }
    function wordCount() external view override returns (uint16) {
        return uint16(words.length);
    }
}

/// @notice Harness to expose library functions via external calls (for vm.expectRevert)
contract NccVerifierHarness {
    function verifyAttack(
        bytes memory narrative,
        ClawttackTypes.NccAttack memory attack,
        address wordDictionary
    ) external view {
        NccVerifier.verifyAttack(narrative, attack, wordDictionary);
    }

    function verifyDefense(ClawttackTypes.NccDefense memory defense) external pure {
        NccVerifier.verifyDefense(defense);
    }

    function verifyReveal(
        ClawttackTypes.NccReveal memory reveal,
        bytes32 storedCommitment,
        uint8 defenderGuessIdx
    ) external pure returns (bool) {
        return NccVerifier.verifyReveal(reveal, storedCommitment, defenderGuessIdx);
    }
}

contract NccVerifierTest is Test {
    MockWordDictionary public dict;
    NccVerifierHarness public harness;

    // "the hero must abandon all ability and be able to learn about the world"
    // abandon=14, ability=26, able=41, about=55
    bytes constant NARRATIVE = "the hero must abandon all ability and be able to learn about the world";

    function setUp() public {
        dict = new MockWordDictionary();
        harness = new NccVerifierHarness();
    }

    function _validAttack() internal pure returns (ClawttackTypes.NccAttack memory) {
        return ClawttackTypes.NccAttack({
            candidateWordIndices: [uint16(0), uint16(1), uint16(2), uint16(3)],
            candidateOffsets: [uint16(14), uint16(26), uint16(41), uint16(55)],
            nccCommitment: keccak256(abi.encodePacked(bytes32(uint256(42)), uint8(0)))
        });
    }

    // ─── verifyAttack ───────────────────────────────────────────────────────

    function test_verifyAttack_valid() public {
        harness.verifyAttack(NARRATIVE, _validAttack(), address(dict));
    }

    function test_verifyAttack_wrongOffset() public {
        ClawttackTypes.NccAttack memory attack = _validAttack();
        attack.candidateOffsets[3] = 10; // wrong offset for "about"
        vm.expectRevert(NccVerifier.CandidateNotInNarrative.selector);
        harness.verifyAttack(NARRATIVE, attack, address(dict));
    }

    function test_verifyAttack_offsetOutOfBounds() public {
        ClawttackTypes.NccAttack memory attack = _validAttack();
        attack.candidateOffsets[3] = 200;
        vm.expectRevert(NccVerifier.CandidateNotInNarrative.selector);
        harness.verifyAttack(NARRATIVE, attack, address(dict));
    }

    function test_verifyAttack_duplicateCandidates() public {
        ClawttackTypes.NccAttack memory attack = _validAttack();
        attack.candidateWordIndices[1] = 0; // duplicate "abandon"
        attack.candidateOffsets[1] = 14;
        vm.expectRevert(NccVerifier.DuplicateCandidate.selector);
        harness.verifyAttack(NARRATIVE, attack, address(dict));
    }

    function test_verifyAttack_missingCommitment() public {
        ClawttackTypes.NccAttack memory attack = _validAttack();
        attack.nccCommitment = bytes32(0);
        vm.expectRevert(NccVerifier.MissingCommitment.selector);
        harness.verifyAttack(NARRATIVE, attack, address(dict));
    }

    function test_verifyAttack_caseInsensitive() public {
        bytes memory upper = "THE HERO MUST ABANDON ALL ABILITY AND BE ABLE TO LEARN ABOUT THE WORLD";
        harness.verifyAttack(upper, _validAttack(), address(dict));
    }

    // ─── verifyDefense ──────────────────────────────────────────────────────

    function test_verifyDefense_valid() public {
        NccVerifier.verifyDefense(ClawttackTypes.NccDefense({guessIdx: 2}));
    }

    function test_verifyDefense_invalidIndex() public {
        vm.expectRevert(NccVerifier.InvalidGuessIndex.selector);
        harness.verifyDefense(ClawttackTypes.NccDefense({guessIdx: 4}));
    }

    // ─── verifyReveal ───────────────────────────────────────────────────────

    function test_verifyReveal_correct() public {
        bytes32 salt = bytes32(uint256(42));
        bytes32 commitment = keccak256(abi.encodePacked(salt, uint8(2)));
        bool correct = harness.verifyReveal(
            ClawttackTypes.NccReveal({salt: salt, intendedIdx: 2}),
            commitment, 2
        );
        assertTrue(correct);
    }

    function test_verifyReveal_wrong() public {
        bytes32 salt = bytes32(uint256(42));
        bytes32 commitment = keccak256(abi.encodePacked(salt, uint8(2)));
        bool correct = harness.verifyReveal(
            ClawttackTypes.NccReveal({salt: salt, intendedIdx: 2}),
            commitment, 1
        );
        assertFalse(correct);
    }

    function test_verifyReveal_mismatch() public {
        bytes32 salt = bytes32(uint256(42));
        bytes32 commitment = keccak256(abi.encodePacked(salt, uint8(2)));
        vm.expectRevert(NccVerifier.RevealMismatch.selector);
        harness.verifyReveal(
            ClawttackTypes.NccReveal({salt: salt, intendedIdx: 1}),
            commitment, 1
        );
    }

    function test_verifyReveal_invalidIndex() public {
        bytes32 salt = bytes32(uint256(42));
        bytes32 commitment = keccak256(abi.encodePacked(salt, uint8(5)));
        vm.expectRevert(NccVerifier.InvalidRevealIndex.selector);
        harness.verifyReveal(
            ClawttackTypes.NccReveal({salt: salt, intendedIdx: 5}),
            commitment, 0
        );
    }

    // ─── computeCommitment ──────────────────────────────────────────────────

    function test_computeCommitment_matches() public {
        bytes32 salt = bytes32(uint256(12345));
        bytes32 fromHelper = NccVerifier.computeCommitment(salt, 3);
        bytes32 manual = keccak256(abi.encodePacked(salt, uint8(3)));
        assertEq(fromHelper, manual);
    }

    // ─── Gas benchmarks ─────────────────────────────────────────────────────

    function test_gas_verifyAttack() public {
        uint256 gasBefore = gasleft();
        harness.verifyAttack(NARRATIVE, _validAttack(), address(dict));
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("verifyAttack gas", gasUsed);
        assertLt(gasUsed, 50000, "verifyAttack should be under 50K gas");
    }

    function test_gas_verifyReveal() public {
        bytes32 salt = bytes32(uint256(42));
        bytes32 commitment = keccak256(abi.encodePacked(salt, uint8(2)));
        uint256 gasBefore = gasleft();
        harness.verifyReveal(
            ClawttackTypes.NccReveal({salt: salt, intendedIdx: 2}),
            commitment, 2
        );
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("verifyReveal gas", gasUsed);
        assertLt(gasUsed, 10000, "verifyReveal should be under 10K gas");
    }
}
