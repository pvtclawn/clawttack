// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {FastSubstring} from "../src/libraries/FastSubstring.sol";
import {LinguisticParser} from "../src/libraries/LinguisticParser.sol";

contract FastSubstringTest is Test {
    // ─── Correctness ────────────────────────────────────────────────────────

    function test_basic_found() public pure {
        assertTrue(FastSubstring.contains("hello world", "world"));
        assertTrue(FastSubstring.contains("hello world", "hello"));
        assertTrue(FastSubstring.contains("hello world", "lo wo"));
    }

    function test_basic_notFound() public pure {
        assertFalse(FastSubstring.contains("hello world", "xyz"));
        assertFalse(FastSubstring.contains("hello", "hello world"));
    }

    function test_caseInsensitive() public pure {
        assertTrue(FastSubstring.contains("Hello World", "hello"));
        assertTrue(FastSubstring.contains("hello world", "HELLO"));
        assertTrue(FastSubstring.contains("HeLLo WoRLd", "hello world"));
    }

    function test_emptyNeedle() public pure {
        assertFalse(FastSubstring.contains("hello", ""));
    }

    function test_emptyHaystack() public pure {
        assertFalse(FastSubstring.contains("", "hello"));
    }

    function test_exactMatch() public pure {
        assertTrue(FastSubstring.contains("hello", "hello"));
        assertTrue(FastSubstring.contains("HELLO", "hello"));
    }

    function test_singleChar() public pure {
        assertTrue(FastSubstring.contains("a", "a"));
        assertTrue(FastSubstring.contains("A", "a"));
        assertFalse(FastSubstring.contains("a", "b"));
    }

    function test_poisonWord_realistic() public pure {
        string memory narrative = "the brave hero walked through the enchanted forest seeking ancient wisdom";
        assertTrue(FastSubstring.contains(narrative, "forest"));
        assertTrue(FastSubstring.contains(narrative, "FOREST"));
        assertFalse(FastSubstring.contains(narrative, "ocean"));
    }

    function test_nearBoundary() public pure {
        assertTrue(FastSubstring.contains("abcdef", "def")); // end
        assertTrue(FastSubstring.contains("abcdef", "abc")); // start
        assertFalse(FastSubstring.contains("abcdef", "defg")); // exceeds
    }

    // ─── Parity with LinguisticParser ───────────────────────────────────────

    function test_parity_basic() public pure {
        string[5] memory haystacks = ["hello world", "HELLO WORLD", "the Quick Brown FOX", "abcdef", "a"];
        string[4] memory needles = ["hello", "world", "fox", "xyz"];

        for (uint i = 0; i < 5; i++) {
            for (uint j = 0; j < 4; j++) {
                bool fast = FastSubstring.contains(haystacks[i], needles[j]);
                bool orig = LinguisticParser.containsSubstring(haystacks[i], needles[j]);
                assertEq(fast, orig, string.concat("Mismatch: ", haystacks[i], " / ", needles[j]));
            }
        }
    }

    // ─── Gas Benchmarks ─────────────────────────────────────────────────────

    function _buildLongNarrative() internal pure returns (string memory) {
        // Build a 1024-byte narrative with poison word at the END (worst case)
        bytes memory b = new bytes(1024);
        for (uint i = 0; i < 1024; i++) {
            b[i] = bytes1(uint8(0x61 + (i % 26))); // a-z repeating
        }
        // Place "poison" at the very end
        bytes memory poison = "poison";
        for (uint i = 0; i < 6; i++) {
            b[1018 + i] = poison[i];
        }
        return string(b);
    }

    function test_gas_fast_worstCase() public {
        string memory narrative = _buildLongNarrative();
        uint256 gasBefore = gasleft();
        bool found = FastSubstring.contains(narrative, "poison");
        uint256 gasUsed = gasBefore - gasleft();
        assertTrue(found);
        emit log_named_uint("FastSubstring 1024B worst-case gas", gasUsed);
        assertLt(gasUsed, 150000, "Should be under 150K gas (3.7x improvement over 514K)");
    }

    function test_gas_original_worstCase() public {
        string memory narrative = _buildLongNarrative();
        uint256 gasBefore = gasleft();
        bool found = LinguisticParser.containsSubstring(narrative, "poison");
        uint256 gasUsed = gasBefore - gasleft();
        assertTrue(found);
        emit log_named_uint("LinguisticParser 1024B worst-case gas", gasUsed);
    }

    function test_gas_fast_notFound() public {
        string memory narrative = _buildLongNarrative();
        uint256 gasBefore = gasleft();
        bool found = FastSubstring.contains(narrative, "zzzzz");
        uint256 gasUsed = gasBefore - gasleft();
        assertFalse(found);
        emit log_named_uint("FastSubstring 1024B not-found gas", gasUsed);
    }

    function test_gas_original_notFound() public {
        string memory narrative = _buildLongNarrative();
        uint256 gasBefore = gasleft();
        bool found = LinguisticParser.containsSubstring(narrative, "zzzzz");
        uint256 gasUsed = gasBefore - gasleft();
        assertFalse(found);
        emit log_named_uint("LinguisticParser 1024B not-found gas", gasUsed);
    }
}
