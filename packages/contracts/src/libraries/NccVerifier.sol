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
     * @notice Non-reverting wrapper for NCC reveal verification.
     * @dev Returns two separate booleans:
     *      - isValidReveal: true if the cryptographic commitment matches
     *      - opponentWasCorrect: true if the defender's guess matched the intended answer
     *      CRITICAL: These must NOT be conflated. A valid reveal with a wrong guess is
     *      normal gameplay. Only an invalid reveal (commitment mismatch) is a forfeit.
     */
    function verifyRevealSafe(
        ClawttackTypes.NccReveal memory reveal,
        bytes32 storedCommitment,
        uint8 defenderGuessIdx,
        uint256 battleId,
        uint256 commitTurnNumber
    ) internal pure returns (bool isValidReveal, bool opponentWasCorrect) {
        if (reveal.intendedIdx > 3) return (false, false);

        bytes32 computedCommitment = keccak256(
            abi.encodePacked(battleId, commitTurnNumber, "NCC", reveal.salt, reveal.intendedIdx)
        );

        if (computedCommitment != storedCommitment) return (false, false);

        return (true, defenderGuessIdx == reveal.intendedIdx);
    }

    /**
     * @notice Verifies the attacker's NCC reveal matches their previous commitment.
     * @dev Called on the attacker's next turn. Domain-separated commitment prevents replay.
     * @param reveal The attacker's reveal (salt + intended index).
     * @param storedCommitment The commitment stored from the previous turn.
     * @param defenderGuessIdx The defender's guess index.
     * @param battleId The battle ID for domain separation.
     * @param commitTurnNumber The turn number when the commitment was made.
     * @return nccCorrect True if the defender's guess matched the revealed intended answer.
     */
    function verifyReveal(
        ClawttackTypes.NccReveal memory reveal,
        bytes32 storedCommitment,
        uint8 defenderGuessIdx,
        uint256 battleId,
        uint256 commitTurnNumber
    ) internal pure returns (bool nccCorrect) {
        if (reveal.intendedIdx > 3) revert InvalidRevealIndex();

        bytes32 computedCommitment = keccak256(
            abi.encodePacked(battleId, commitTurnNumber, "NCC", reveal.salt, reveal.intendedIdx)
        );

        if (computedCommitment != storedCommitment) revert RevealMismatch();

        return defenderGuessIdx == reveal.intendedIdx;
    }

    /**
     * @notice Compute an NCC commitment off-chain (helper for SDKs).
     * @param battleId The battle ID for domain separation.
     * @param turnNumber The turn number when the commitment is made.
     * @param salt Random 32-byte salt.
     * @param intendedIdx The intended answer index (0-3).
     * @return commitment The commitment hash.
     */
    function computeCommitment(
        uint256 battleId,
        uint256 turnNumber,
        bytes32 salt,
        uint8 intendedIdx
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(battleId, turnNumber, "NCC", salt, intendedIdx));
    }

    /**
     * @notice Compute a VOP commitment off-chain (helper for SDKs).
     * @param battleId The battle ID for domain separation.
     * @param turnNumber The turn number when the commitment is made.
     * @param vopSalt Random 32-byte salt.
     * @param vopIndex The VOP type index.
     * @param instanceCommit keccak256 of instance params, or bytes32(0) for simple VOPs.
     * @return commitment The VOP commitment hash.
     */
    function computeVopCommitment(
        uint256 battleId,
        uint256 turnNumber,
        bytes32 vopSalt,
        uint8 vopIndex,
        bytes32 instanceCommit
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(battleId, turnNumber, "VOP", vopSalt, vopIndex, instanceCommit));
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    function _toLowerCase(bytes1 b) private pure returns (bytes1) {
        if (b >= 0x41 && b <= 0x5A) {
            return bytes1(uint8(b) + 32);
        }
        return b;
    }
}
