// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {HashPreimageVOP} from "../src/vops/HashPreimageVOP.sol";
import {MirrorHashVOP} from "../src/vops/MirrorHashVOP.sol";
import {CascadeHashVOP} from "../src/vops/CascadeHashVOP.sol";
import {PrimeModuloVOP} from "../src/vops/PrimeModuloVOP.sol";
import {XorFoldVOP} from "../src/vops/XorFoldVOP.sol";
import {EntropyMixVOP} from "../src/vops/EntropyMixVOP.sol";
import {SequenceHashVOP} from "../src/vops/SequenceHashVOP.sol";
import {TimestampHashVOP} from "../src/vops/TimestampHashVOP.sol";
import {CoinbaseHashVOP} from "../src/vops/CoinbaseHashVOP.sol";
import {PopCountVOP} from "../src/vops/PopCountVOP.sol";
import {FibHashVOP} from "../src/vops/FibHashVOP.sol";

/// @notice Unit tests for all simple hash VOPs (no instanceCommit needed).
///         Each VOP derives its answer from blockhash(blockNumber).
///         Tests verify: correct solution works, wrong solution fails, stale block fails.
contract SimpleVOPTest is Test {
    HashPreimageVOP hashVop;
    MirrorHashVOP mirrorVop;
    CascadeHashVOP cascadeVop;
    PrimeModuloVOP primeVop;
    XorFoldVOP xorVop;
    EntropyMixVOP entropyVop;
    SequenceHashVOP sequenceVop;
    TimestampHashVOP timestampVop;
    CoinbaseHashVOP coinbaseVop;
    PopCountVOP popCountVop;
    FibHashVOP fibVop;

    uint64 constant BLK = 100;

    function setUp() public {
        hashVop = new HashPreimageVOP();
        mirrorVop = new MirrorHashVOP();
        cascadeVop = new CascadeHashVOP();
        primeVop = new PrimeModuloVOP();
        xorVop = new XorFoldVOP();
        entropyVop = new EntropyMixVOP();
        sequenceVop = new SequenceHashVOP();
        timestampVop = new TimestampHashVOP();
        coinbaseVop = new CoinbaseHashVOP();
        popCountVop = new PopCountVOP();
        fibVop = new FibHashVOP();

        vm.roll(102); // So blockhash(100) and blockhash(99) are available
    }

    // Helper: build params without instanceCommit (backward compat)
    function _params(uint64 blk) internal pure returns (bytes memory) {
        return abi.encode(blk, bytes32(0));
    }

    function _sol(uint256 v) internal pure returns (bytes memory) {
        return abi.encode(v);
    }

    // ═══════════════════════════════════════════════════════════════════
    // MirrorHashVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_mirror_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 expected = uint256(keccak256(abi.encode(seed, "MIRROR")));
        assertTrue(mirrorVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_mirror_wrong() public {
        assertFalse(mirrorVop.verify(_params(BLK), _sol(12345), 0));
    }

    function test_mirror_stale_block() public {
        vm.roll(500); // block 100 is now > 256 blocks ago
        assertFalse(mirrorVop.verify(_params(BLK), _sol(0), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // CascadeHashVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_cascade_correct() public {
        bytes32 seed = blockhash(BLK);
        bytes32 h = keccak256(abi.encode(seed));
        h = keccak256(abi.encode(h));
        h = keccak256(abi.encode(h));
        assertTrue(cascadeVop.verify(_params(BLK), _sol(uint256(h)), 0));
    }

    function test_cascade_wrong() public {
        assertFalse(cascadeVop.verify(_params(BLK), _sol(999), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // PrimeModuloVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_prime_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 expected = uint256(seed) % 2147483647;
        assertTrue(primeVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_prime_wrong() public {
        assertFalse(primeVop.verify(_params(BLK), _sol(0xDEAD), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // XorFoldVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_xorFold_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 s = uint256(seed);
        uint128 high = uint128(s >> 128);
        uint128 low = uint128(s);
        uint256 expected = uint256(high ^ low);
        assertTrue(xorVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_xorFold_wrong() public {
        assertFalse(xorVop.verify(_params(BLK), _sol(42), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // EntropyMixVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_entropy_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 expected = uint256(seed) ^ uint256(keccak256(abi.encode(seed)));
        assertTrue(entropyVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_entropy_wrong() public {
        assertFalse(entropyVop.verify(_params(BLK), _sol(7777), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // SequenceHashVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_sequence_correct() public {
        bytes32 seed100 = blockhash(100);
        bytes32 seed99 = blockhash(99);
        uint256 expected = uint256(keccak256(abi.encode(seed100, seed99)));
        assertTrue(sequenceVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_sequence_wrong() public {
        assertFalse(sequenceVop.verify(_params(BLK), _sol(0), 0));
    }

    function test_sequence_block_zero_fails() public {
        assertFalse(sequenceVop.verify(_params(0), _sol(0), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // TimestampHashVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_timestamp_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 expected = uint256(keccak256(abi.encode(seed, uint256(BLK), "TIME")));
        assertTrue(timestampVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_timestamp_wrong() public {
        assertFalse(timestampVop.verify(_params(BLK), _sol(1111), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // CoinbaseHashVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_coinbase_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 expected = uint256(keccak256(abi.encode(seed, uint256(BLK), "COINBASE")));
        assertTrue(coinbaseVop.verify(_params(BLK), _sol(expected), 0));
    }

    function test_coinbase_wrong() public {
        assertFalse(coinbaseVop.verify(_params(BLK), _sol(2222), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // PopCountVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_popcount_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 v = uint256(seed);
        uint256 count;
        while (v != 0) { count += v & 1; v >>= 1; }
        assertTrue(popCountVop.verify(_params(BLK), _sol(count), 0));
    }

    function test_popcount_wrong() public {
        assertFalse(popCountVop.verify(_params(BLK), _sol(999), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // FibHashVOP
    // ═══════════════════════════════════════════════════════════════════

    function test_fib_correct() public {
        bytes32 seed = blockhash(BLK);
        uint256 s = uint256(seed);
        uint256 a = s >> 128;
        uint256 b = s & type(uint128).max;
        for (uint256 i = 0; i < 10; i++) {
            uint256 next;
            unchecked { next = a + b; }
            a = b;
            b = next;
        }
        assertTrue(fibVop.verify(_params(BLK), _sol(b), 0));
    }

    function test_fib_wrong() public {
        assertFalse(fibVop.verify(_params(BLK), _sol(0xBEEF), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // HashPreimageVOP (brute-force search needed)
    // ═══════════════════════════════════════════════════════════════════

    function test_hashPreimage_valid_solution() public {
        bytes32 seed = blockhash(BLK);
        uint8 zeroBits = uint8(8 + (BLK % 4)); // 8 for block 100

        // Brute-force a valid preimage (should find within ~256 iterations for 8 bits)
        uint256 sol;
        bool found;
        for (uint256 i = 0; i < 2048; i++) {
            bytes32 h = keccak256(abi.encode(seed, i));
            if (uint256(h) >> (256 - zeroBits) == 0) {
                sol = i;
                found = true;
                break;
            }
        }
        assertTrue(found, "should find preimage within 2048 tries");
        assertTrue(hashVop.verify(_params(BLK), _sol(sol), 0));
    }

    function test_hashPreimage_wrong_solution() public {
        // Solution 0 is unlikely to have the required leading zeros
        // (but could theoretically pass. Use a known bad value)
        bytes32 seed = blockhash(BLK);
        uint8 zeroBits = uint8(8 + (BLK % 4));
        bytes32 h = keccak256(abi.encode(seed, uint256(type(uint256).max)));
        if (uint256(h) >> (256 - zeroBits) != 0) {
            // This solution doesn't have leading zeros — should fail
            assertFalse(hashVop.verify(_params(BLK), _sol(type(uint256).max), 0));
        }
        // If by cosmic chance it does have zeros, skip test
    }

    function test_hashPreimage_stale_block() public {
        vm.roll(500);
        assertFalse(hashVop.verify(_params(BLK), _sol(0), 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Name tests
    // ═══════════════════════════════════════════════════════════════════

    function test_names() public {
        assertEq(hashVop.name(), "HashPreimage");
        assertEq(mirrorVop.name(), "MirrorHash");
        assertEq(cascadeVop.name(), "CascadeHash");
        assertEq(primeVop.name(), "PrimeModulo");
        assertEq(xorVop.name(), "XorFold");
        assertEq(entropyVop.name(), "EntropyMix");
        assertEq(sequenceVop.name(), "SequenceHash");
        assertEq(timestampVop.name(), "TimestampHash");
        assertEq(coinbaseVop.name(), "CoinbaseHash");
        assertEq(popCountVop.name(), "PopCount");
        assertEq(fibVop.name(), "FibHash");
    }
}
