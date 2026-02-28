// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title FastSubstring
 * @notice Assembly-optimized case-insensitive substring search.
 * @dev v3: Uses byte-level scanning with pre-lowered needle.
 *      For BIP39 poison word checking (needle ≤ 32 bytes).
 *
 * Gas benchmarks (1024-byte haystack, 6-char needle):
 * - LinguisticParser.containsSubstring: ~514K gas
 * - FastSubstring v1: ~138K gas (3.7x)
 * - FastSubstring v3: target ~80K gas
 */
library FastSubstring {
    /**
     * @notice Case-insensitive substring search.
     * @param haystack The text to search in.
     * @param needle The substring to find (must be ≤ 32 bytes).
     * @return found True if needle exists in haystack (case-insensitive).
     */
    function contains(string memory haystack, string memory needle) internal pure returns (bool found) {
        assembly {
            let hLen := mload(haystack)
            let nLen := mload(needle)

            found := 0
            if and(gt(nLen, 0), iszero(lt(hLen, nLen))) {
                let hPtr := add(haystack, 32)
                let nPtr := add(needle, 32)

                // Pre-compute lowered needle bytes (needle ≤ 32 bytes for BIP39)
                let nWord := mload(nPtr)
                let loweredNeedle := 0
                for { let k := 0 } lt(k, nLen) { k := add(k, 1) } {
                    let nb := byte(k, nWord)
                    if and(gt(nb, 0x40), lt(nb, 0x5B)) { nb := add(nb, 0x20) }
                    loweredNeedle := or(loweredNeedle, shl(mul(sub(31, k), 8), nb))
                }
                let nFirst := byte(0, loweredNeedle)

                // Also compute uppercase first byte for dual-scan
                let nFirstUpper := 0
                if and(gt(nFirst, 0x60), lt(nFirst, 0x7B)) {
                    nFirstUpper := sub(nFirst, 0x20)
                }

                let limit := sub(add(hLen, 1), nLen)

                for { let i := 0 } lt(i, limit) { i := add(i, 1) } {
                    let hByte := byte(0, mload(add(hPtr, i)))

                    // Quick check: does this byte match first needle char (either case)?
                    let firstMatch := or(eq(hByte, nFirst), eq(hByte, nFirstUpper))

                    if firstMatch {
                        let matched := 1

                        for { let j := 1 } lt(j, nLen) { j := add(j, 1) } {
                            let hb := byte(0, mload(add(add(hPtr, i), j)))
                            if and(gt(hb, 0x40), lt(hb, 0x5B)) {
                                hb := add(hb, 0x20)
                            }
                            if iszero(eq(hb, byte(j, loweredNeedle))) {
                                matched := 0
                                j := nLen
                            }
                        }

                        if matched {
                            found := 1
                            i := limit
                        }
                    }
                }
            }
        }
    }
}
