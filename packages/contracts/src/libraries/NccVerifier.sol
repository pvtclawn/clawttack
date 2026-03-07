// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackTypes} from "./ClawttackTypes.sol";
import {IWordDictionary} from "../interfaces/IWordDictionary.sol";

/**
 * @title NccVerifier
 * @notice Validates Narrative Comprehension Challenge (NCC) mechanics.
 * @dev Offset-based verification: O(word_length) per candidate, ~200 gas each.
 *      Total NCC overhead: ~3-5K gas per turn (vs 1.83M for ZK approach).
 *
 * Flow per turn:
 *   1. Attacker submits NccAttack: 4 candidates + offsets + commitment
 *   2. Contract verifies all 4 words at claimed offsets (this library)
 *   3. Defender submits NccDefense: picks 1 of 4
 *   4. Attacker reveals NccReveal: salt + intendedIdx
 *   5. Contract checks reveal matches commitment
 *   6. ChessClockLib applies refund (correct) or penalty (wrong)
 */
library NccVerifier {
    // ─── Errors ─────────────────────────────────────────────────────────────
    error InvalidCandidateCount();       // Must provide exactly 4 candidates
    error CandidateNotInNarrative();     // Word not found at claimed offset
    error DuplicateCandidate();          // Same word index used twice
    error InvalidGuessIndex();           // guessIdx must be 0-3
    error InvalidRevealIndex();          // intendedIdx must be 0-3
    error RevealMismatch();              // Reveal doesn't match commitment
    error MissingCommitment();           // No NCC commitment provided
    error MissingReveal();               // Attacker didn't reveal previous NCC

    /**
     * @notice Verifies that all 4 NCC candidates exist at their claimed offsets in the narrative.
     * @dev Called during turn submission. Gas: ~800-1600 (4x offset checks).
     * @param narrative The narrative text bytes.
     * @param attack The attacker's NCC challenge.
     * @param wordDictionary Address of the BIP39 word dictionary contract.
     */
    function verifyAttack(
        bytes memory narrative,
        ClawttackTypes.NccAttack memory attack,
        address wordDictionary
    ) internal view {
        if (attack.nccCommitment == bytes32(0)) revert MissingCommitment();

        // Check for duplicate candidates
        for (uint8 i = 0; i < 4; i++) {
            for (uint8 j = i + 1; j < 4; j++) {
                if (attack.candidateWordIndices[i] == attack.candidateWordIndices[j]) {
                    revert DuplicateCandidate();
                }
            }
        }

        // Verify each candidate exists at its claimed offset
        for (uint8 i = 0; i < 4; i++) {
            string memory word = IWordDictionary(wordDictionary).word(attack.candidateWordIndices[i]);
            bytes memory wordBytes = bytes(word);

            uint16 offset = attack.candidateOffsets[i];

            // Check bounds
            if (offset + wordBytes.length > narrative.length) {
                revert CandidateNotInNarrative();
            }

            // O(word_length) comparison at offset
            for (uint256 k = 0; k < wordBytes.length; k++) {
                // Case-insensitive comparison
                bytes1 narrativeByte = _toLowerCase(narrative[offset + k]);
                bytes1 wordByte = _toLowerCase(wordBytes[k]);
                if (narrativeByte != wordByte) {
                    revert CandidateNotInNarrative();
                }
            }
        }
    }

    /**
     * @notice Validates the defender's NCC guess.
     * @param defense The defender's guess (0-3).
     */
    function verifyDefense(
        ClawttackTypes.NccDefense memory defense
    ) internal pure {
        if (defense.guessIdx > 3) revert InvalidGuessIndex();
    }

    /**
     * @notice Verifies the attacker's NCC reveal matches their previous commitment.
     * @dev Called on the attacker's next turn. Checks keccak256(salt, intendedIdx) == commitment.
     * @param reveal The attacker's reveal (salt + intended index).
     * @param storedCommitment The commitment stored from the previous turn.
     * @return nccCorrect True if the defender's guess matched the revealed intended answer.
     */
    function verifyReveal(
        ClawttackTypes.NccReveal memory reveal,
        bytes32 storedCommitment,
        uint8 defenderGuessIdx
    ) internal pure returns (bool nccCorrect) {
        if (reveal.intendedIdx > 3) revert InvalidRevealIndex();

        bytes32 computedCommitment = keccak256(
            abi.encodePacked(reveal.salt, reveal.intendedIdx)
        );

        if (computedCommitment != storedCommitment) revert RevealMismatch();

        return defenderGuessIdx == reveal.intendedIdx;
    }

    /**
     * @notice Compute an NCC commitment off-chain (helper for SDKs).
     * @param salt Random 32-byte salt.
     * @param intendedIdx The intended answer index (0-3).
     * @return commitment The commitment hash.
     */
    function computeCommitment(
        bytes32 salt,
        uint8 intendedIdx
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(salt, intendedIdx));
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    function _toLowerCase(bytes1 b) private pure returns (bytes1) {
        if (b >= 0x41 && b <= 0x5A) {
            return bytes1(uint8(b) + 32);
        }
        return b;
    }
}
