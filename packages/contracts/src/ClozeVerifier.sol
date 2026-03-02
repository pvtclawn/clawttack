// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ClozeVerifier
 * @notice Verifies NCC Cloze test mechanics for Clawttack v4.1
 * 
 * Cloze test: Attacker replaces one BIP39 word with [BLANK] in narrative.
 * Defender must guess which of 4 candidate words fills the blank.
 * LLMs can infer from context (~75-80%), scripts guess randomly (25%).
 *
 * Gas target: <10K additional overhead per turn.
 */
library ClozeVerifier {
    /// @dev The blank marker that must appear exactly once in narratives
    bytes constant BLANK_MARKER = "[BLANK]";
    uint256 constant BLANK_LEN = 7; // length of "[BLANK]"
    
    error BlankNotFound();
    error MultipleBlankFound();
    error RevealedWordNotAtBlank();
    error NarrativeTooShortForCloze();

    /**
     * @notice Verify that a narrative contains exactly one [BLANK] marker
     * @param narrative The narrative bytes
     * @return blankOffset The byte offset where [BLANK] starts
     */
    function verifyBlank(bytes memory narrative) internal pure returns (uint256 blankOffset) {
        if (narrative.length < BLANK_LEN) revert NarrativeTooShortForCloze();
        
        bool found = false;
        uint256 limit = narrative.length - BLANK_LEN;
        
        for (uint256 i = 0; i <= limit;) {
            if (
                narrative[i] == 0x5B &&     // [
                narrative[i+1] == 0x42 &&   // B
                narrative[i+2] == 0x4C &&   // L
                narrative[i+3] == 0x41 &&   // A
                narrative[i+4] == 0x4E &&   // N
                narrative[i+5] == 0x4B &&   // K
                narrative[i+6] == 0x5D      // ]
            ) {
                if (found) revert MultipleBlankFound();
                blankOffset = i;
                found = true;
                unchecked { i += BLANK_LEN; }
            } else {
                unchecked { ++i; }
            }
        }
        
        if (!found) revert BlankNotFound();
        return blankOffset;
    }

    /**
     * @notice Reconstruct the original narrative by replacing [BLANK] with the revealed word
     * @param narrative The narrative with [BLANK]
     * @param blankOffset Where [BLANK] starts
     * @param revealedWord The word that was blanked
     * @return original The reconstructed narrative
     */
    function reconstruct(
        bytes memory narrative,
        uint256 blankOffset,
        bytes memory revealedWord
    ) internal pure returns (bytes memory original) {
        // original = narrative[0..blankOffset] + revealedWord + narrative[blankOffset+7..]
        uint256 afterBlank = blankOffset + BLANK_LEN;
        original = new bytes(narrative.length - BLANK_LEN + revealedWord.length);
        
        // Copy prefix
        for (uint256 i = 0; i < blankOffset;) {
            original[i] = narrative[i];
            unchecked { ++i; }
        }
        // Copy revealed word
        for (uint256 i = 0; i < revealedWord.length;) {
            original[blankOffset + i] = revealedWord[i];
            unchecked { ++i; }
        }
        // Copy suffix
        uint256 suffixStart = blankOffset + revealedWord.length;
        for (uint256 i = afterBlank; i < narrative.length;) {
            original[suffixStart + i - afterBlank] = narrative[i];
            unchecked { ++i; }
        }
    }

    /**
     * @notice Verify the revealed word appears at the blank offset in the reconstructed narrative,
     *         AND that the revealed word is the committed answer (checked externally via NCC)
     * @param narrative The narrative containing [BLANK]
     * @param revealedWord The BIP39 word that was blanked
     * @param blankOffset Where [BLANK] is located
     * @return valid Whether the reconstruction is valid
     */
    function verifyReveal(
        bytes memory narrative,
        bytes memory revealedWord,
        uint256 blankOffset
    ) internal pure returns (bool valid) {
        // Just verify the blank is at the stated offset
        if (blankOffset + BLANK_LEN > narrative.length) return false;
        
        // Verify [BLANK] is actually at that offset
        if (
            narrative[blankOffset] != 0x5B ||
            narrative[blankOffset+1] != 0x42 ||
            narrative[blankOffset+2] != 0x4C ||
            narrative[blankOffset+3] != 0x41 ||
            narrative[blankOffset+4] != 0x4E ||
            narrative[blankOffset+5] != 0x4B ||
            narrative[blankOffset+6] != 0x5D
        ) return false;
        
        return true;
    }
}
