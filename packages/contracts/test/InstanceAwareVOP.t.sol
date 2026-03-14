// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ArithmeticVOP} from "../src/vops/ArithmeticVOP.sol";
import {KeywordHashVOP} from "../src/vops/KeywordHashVOP.sol";
import {CoordinateVOP} from "../src/vops/CoordinateVOP.sol";
import {PhraseHashVOP} from "../src/vops/PhraseHashVOP.sol";

/// @notice Tests for instance-aware VOPs that use the instanceCommit mechanic.
contract InstanceAwareVOPTest is Test {
    ArithmeticVOP arithmeticVop;
    KeywordHashVOP keywordVop;
    CoordinateVOP coordVop;
    PhraseHashVOP phraseVop;

    uint64 constant TEST_BLOCK = 100;

    function setUp() public {
        arithmeticVop = new ArithmeticVOP();
        keywordVop = new KeywordHashVOP();
        coordVop = new CoordinateVOP();
        phraseVop = new PhraseHashVOP();
        // Roll to block 101 so blockhash(100) is available
        vm.roll(101);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ArithmeticVOP Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_arithmetic_add() public {
        uint256 a = 42;
        uint256 b = 7;
        uint8 op = 0; // ADD
        bytes32 instanceCommit = keccak256(abi.encode(a, b, op));

        // Compute expected answer
        uint256 rawResult = a + b; // 49
        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 expected = uint256(keccak256(abi.encode(rawResult, blockSeed)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(expected, a, b, op);

        assertTrue(arithmeticVop.verify(params, solution, 0));
    }

    function test_arithmetic_mul() public {
        uint256 a = 42;
        uint256 b = 7;
        uint8 op = 1; // MUL
        bytes32 instanceCommit = keccak256(abi.encode(a, b, op));

        uint256 rawResult = a * b; // 294
        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 expected = uint256(keccak256(abi.encode(rawResult, blockSeed)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(expected, a, b, op);

        assertTrue(arithmeticVop.verify(params, solution, 0));
    }

    function test_arithmetic_wrong_params_fail() public {
        uint256 a = 42;
        uint256 b = 7;
        uint8 op = 1; // MUL
        bytes32 instanceCommit = keccak256(abi.encode(a, b, op));

        // Solver guessed wrong params (99, 3, ADD)
        uint256 rawResult = 99 + 3;
        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 answer = uint256(keccak256(abi.encode(rawResult, blockSeed)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(answer, uint256(99), uint256(3), uint8(0));

        // keccak256(99,3,0) != keccak256(42,7,1) → fails
        assertFalse(arithmeticVop.verify(params, solution, 0));
    }

    function test_arithmetic_right_params_wrong_answer_fail() public {
        uint256 a = 42;
        uint256 b = 7;
        uint8 op = 1; // MUL
        bytes32 instanceCommit = keccak256(abi.encode(a, b, op));

        // Right params but wrong answer
        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(uint256(999), a, b, op);

        assertFalse(arithmeticVop.verify(params, solution, 0));
    }

    function test_arithmetic_no_instance_fails() public {
        // instanceCommit = 0 → should fail (this VOP requires it)
        bytes memory params = abi.encode(TEST_BLOCK, bytes32(0));
        bytes memory solution = abi.encode(uint256(0), uint256(1), uint256(2), uint8(0));

        assertFalse(arithmeticVop.verify(params, solution, 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // KeywordHashVOP Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_keyword_correct() public {
        string memory keyword = "phoenix";
        bytes32 instanceCommit = keccak256(abi.encode(keyword));

        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 expected = uint256(keccak256(abi.encode(keyword, blockSeed)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(expected, keyword);

        assertTrue(keywordVop.verify(params, solution, 0));
    }

    function test_keyword_wrong_word_fail() public {
        string memory keyword = "phoenix";
        bytes32 instanceCommit = keccak256(abi.encode(keyword));

        // Solver guessed "dragon" instead of "phoenix"
        string memory wrong = "dragon";
        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 answer = uint256(keccak256(abi.encode(wrong, blockSeed)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(answer, wrong);

        // keccak256("dragon") != keccak256("phoenix") → fails
        assertFalse(keywordVop.verify(params, solution, 0));
    }

    function test_keyword_right_word_wrong_hash_fail() public {
        string memory keyword = "phoenix";
        bytes32 instanceCommit = keccak256(abi.encode(keyword));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(uint256(12345), keyword);

        assertFalse(keywordVop.verify(params, solution, 0));
    }

    function test_keyword_no_instance_fails() public {
        bytes memory params = abi.encode(TEST_BLOCK, bytes32(0));
        bytes memory solution = abi.encode(uint256(0), "anything");

        assertFalse(keywordVop.verify(params, solution, 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Different block → different answer (even with same params)
    // ═══════════════════════════════════════════════════════════════════

    function test_arithmetic_different_block_different_answer() public {
        // Roll further so blocks 100 and 99 both have blockhashes
        vm.roll(102);

        uint256 a = 10;
        uint256 b = 20;
        uint8 op = 0; // ADD
        bytes32 instanceCommit = keccak256(abi.encode(a, b, op));

        // Solution for block 100
        bytes32 seed100 = blockhash(100);
        uint256 answer100 = uint256(keccak256(abi.encode(a + b, seed100)));

        // Same instance params but block 99
        bytes32 seed99 = blockhash(99);
        uint256 answer99 = uint256(keccak256(abi.encode(a + b, seed99)));

        // Answers must differ (unless hash collision)
        assertTrue(answer100 != answer99, "same params, different blocks -> different answers");

        // Answer for block 100 should not verify against block 99
        bytes memory params99 = abi.encode(uint64(99), instanceCommit);
        bytes memory solution100 = abi.encode(answer100, a, b, op);
        assertFalse(arithmeticVop.verify(params99, solution100, 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Name tests
    // ═══════════════════════════════════════════════════════════════════

    function test_arithmetic_name() public {
        assertEq(arithmeticVop.name(), "Arithmetic");
    }

    function test_keyword_name() public {
        assertEq(keywordVop.name(), "KeywordHash");
    }

    // ═══════════════════════════════════════════════════════════════════
    // CoordinateVOP Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_coordinate_correct() public {
        uint256 x1 = 3; uint256 y1 = 4; uint256 x2 = 6; uint256 y2 = 8;
        bytes32 instanceCommit = keccak256(abi.encode(x1, y1, x2, y2));

        uint256 distance = 3 + 4; // |6-3| + |8-4| = 7
        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 expected = uint256(keccak256(abi.encode(distance, blockSeed)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(expected, x1, y1, x2, y2);

        assertTrue(coordVop.verify(params, solution, 0));
    }

    function test_coordinate_wrong_coords_fail() public {
        bytes32 instanceCommit = keccak256(abi.encode(uint256(3), uint256(4), uint256(6), uint256(8)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(uint256(0), uint256(1), uint256(1), uint256(1), uint256(1));

        assertFalse(coordVop.verify(params, solution, 0));
    }

    function test_coordinate_name() public {
        assertEq(coordVop.name(), "Coordinate");
    }

    // ═══════════════════════════════════════════════════════════════════
    // PhraseHashVOP Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_phrase_correct() public {
        string memory phrase = "the moon rises twice";
        bytes32 instanceCommit = keccak256(abi.encode(phrase));

        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 expected = uint256(keccak256(abi.encode(phrase, blockSeed, bytes(phrase).length)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(expected, phrase);

        assertTrue(phraseVop.verify(params, solution, 0));
    }

    function test_phrase_wrong_phrase_fail() public {
        string memory phrase = "the moon rises twice";
        bytes32 instanceCommit = keccak256(abi.encode(phrase));

        string memory wrong = "the sun sets once";
        bytes32 blockSeed = blockhash(TEST_BLOCK);
        uint256 answer = uint256(keccak256(abi.encode(wrong, blockSeed, bytes(wrong).length)));

        bytes memory params = abi.encode(TEST_BLOCK, instanceCommit);
        bytes memory solution = abi.encode(answer, wrong);

        assertFalse(phraseVop.verify(params, solution, 0));
    }

    function test_phrase_name() public {
        assertEq(phraseVop.name(), "PhraseHash");
    }
}
