// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackErrors} from "./ClawttackErrors.sol";

/**
 * @title LinguisticParser
 * @notice Pure library for validating narrative rules (ASCII, Boundaries, Substrings).
 * @dev Methods are `internal` so they compile directly into the importing contract (Zero runtime gas overhead).
 */
library LinguisticParser {
    uint256 public constant MAX_JOKER_NARRATIVE_LEN = 1024;
    uint256 public constant MIN_NARRATIVE_LEN = 64;
    uint8 public constant MAX_ASCII_VALUE = 127;
    bytes1 public constant ASCII_A_UPPER = 0x41;
    bytes1 public constant ASCII_Z_UPPER = 0x5A;
    bytes1 public constant ASCII_A_LOWER = 0x61;
    bytes1 public constant ASCII_Z_LOWER = 0x7A;
    uint8 public constant ASCII_CASE_OFFSET = 32;

    function verifyLinguistics(string memory narrative, string memory targetWord, string memory poisonWord)
        internal
        pure
    {
        bytes memory n = bytes(narrative);
        bytes memory t = bytes(targetWord);
        bytes memory p = bytes(poisonWord);

        uint256 len = n.length;
        if (len < MIN_NARRATIVE_LEN) revert ClawttackErrors.NarrativeTooShort();

        bool foundTarget = false;
        bytes1 pFirst = p.length > 0 ? _toLowerCase(p[0]) : bytes1(0);
        bytes1 tFirst = t.length > 0 ? _toLowerCase(t[0]) : bytes1(0);

        for (uint256 i = 0; i < len; i++) {
            bytes1 char = n[i];
            if (uint8(char) > MAX_ASCII_VALUE) revert ClawttackErrors.InvalidASCII();

            bytes1 charLower = _toLowerCase(char);

            if (p.length > 0 && i + p.length <= len && charLower == pFirst) {
                bool matchP = true;
                for (uint256 j = 1; j < p.length; j++) {
                    if (_toLowerCase(n[i + j]) != _toLowerCase(p[j])) {
                        matchP = false;
                        break;
                    }
                }
                // Poison is an immediate, catastrophic failure. Do not keep looping.
                if (matchP) revert ClawttackErrors.PoisonWordDetected();
            }

            if (!foundTarget && t.length > 0 && i + t.length <= len && charLower == tFirst) {
                bool isStartBoundary = (i == 0) || !_isLetter(n[i - 1]);
                bool isEndBoundary = (i + t.length == len) || !_isLetter(n[i + t.length]);

                if (isStartBoundary && isEndBoundary) {
                    bool matchT = true;
                    for (uint256 j = 1; j < t.length; j++) {
                        if (_toLowerCase(n[i + j]) != _toLowerCase(t[j])) {
                            matchT = false;
                            break;
                        }
                    }
                    if (matchT) foundTarget = true;
                }
            }
        }

        if (!foundTarget) revert ClawttackErrors.TargetWordMissing();
    }

    function wouldPass(
        string memory narrative,
        string memory targetWord,
        string memory poisonWord
    ) internal pure returns (bool passesTarget, bool passesPoison, bool passesLength, bool passesAscii) {
        bytes memory n = bytes(narrative);
        bytes memory t = bytes(targetWord);
        bytes memory p = bytes(poisonWord);
        
        uint256 len = n.length;
        passesLength = len >= MIN_NARRATIVE_LEN && len <= MAX_JOKER_NARRATIVE_LEN;
        
        passesTarget = false;
        passesPoison = true;
        passesAscii = true;

        bytes1 pFirst = p.length > 0 ? _toLowerCase(p[0]) : bytes1(0);
        bytes1 tFirst = t.length > 0 ? _toLowerCase(t[0]) : bytes1(0);

        for (uint256 i = 0; i < len; i++) {
            bytes1 char = n[i];
            if (uint8(char) > MAX_ASCII_VALUE) passesAscii = false;

            bytes1 charLower = _toLowerCase(char);

            if (passesPoison && p.length > 0 && i + p.length <= len && charLower == pFirst) {
                bool matchP = true;
                for (uint256 j = 1; j < p.length; j++) {
                    if (_toLowerCase(n[i + j]) != _toLowerCase(p[j])) {
                        matchP = false;
                        break;
                    }
                }
                if (matchP) passesPoison = false; 
            }

            if (!passesTarget && t.length > 0 && i + t.length <= len && charLower == tFirst) {
                bool isStartBoundary = (i == 0) || !_isLetter(n[i - 1]);
                bool isEndBoundary = (i + t.length == len) || !_isLetter(n[i + t.length]);

                if (isStartBoundary && isEndBoundary) {
                    bool matchT = true;
                    for (uint256 j = 1; j < t.length; j++) {
                        if (_toLowerCase(n[i + j]) != _toLowerCase(t[j])) {
                            matchT = false;
                            break;
                        }
                    }
                    if (matchT) passesTarget = true;
                }
            }
        }
    }

    function _toLowerCase(bytes1 b) internal pure returns (bytes1) {
        if (b >= ASCII_A_UPPER && b <= ASCII_Z_UPPER) {
            return bytes1(uint8(b) + ASCII_CASE_OFFSET);
        }
        return b;
    }

    function _isLetter(bytes1 b) internal pure returns (bool) {
        return (b >= ASCII_A_UPPER && b <= ASCII_Z_UPPER) || (b >= ASCII_A_LOWER && b <= ASCII_Z_LOWER);
    }
}
