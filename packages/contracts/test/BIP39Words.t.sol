// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BIP39Words.sol";

/// @dev Helper to deploy packed BIP39 data as a contract (SSTORE2 pattern)
contract BIP39WordsDataDeployer {
    /// @notice Deploy a data contract containing packed BIP39 words
    /// @param packedWords Length-prefixed packed words (1-byte len + word bytes each)
    /// @return addr The address of the deployed data contract
    function deploy(bytes memory packedWords) external returns (address addr) {
        // SSTORE2 pattern: deploy data as contract bytecode
        // Init code: STOP prefix + data as runtime code
        // We need init code that RETURNs (STOP + packedWords) as the runtime bytecode
        bytes memory data = abi.encodePacked(hex"00", packedWords);
        uint256 dataLen = data.length;
        
        // Init code: PUSH dataLen, PUSH offset, PUSH 0, CODECOPY, PUSH dataLen, PUSH 0, RETURN
        // But simpler with Solidity create:
        bytes memory initCode = abi.encodePacked(
            // PUSH1 dataLen (or PUSH2 for >255)
            // CODECOPY(destOffset=0, offset=initCodeLen, size=dataLen)
            // RETURN(offset=0, size=dataLen)
            hex"61",                    // PUSH2
            uint16(dataLen),            // data length
            hex"80",                    // DUP1
            hex"60",                    // PUSH1
            uint8(12),                  // init code length (this block = 12 bytes)
            hex"60",                    // PUSH1
            uint8(0),                   // memory offset 0
            hex"39",                    // CODECOPY
            hex"60",                    // PUSH1
            uint8(0),                   // memory offset 0
            hex"f3",                    // RETURN
            data                        // the actual data (appended after init code)
        );
        
        assembly {
            addr := create(0, add(initCode, 32), mload(initCode))
        }
        require(addr != address(0), "Deploy failed");
    }
}

contract BIP39WordsTest is Test {
    BIP39Words public bip39;
    BIP39WordsDataDeployer public deployer;

    // First 10 BIP39 words for testing
    string[10] expectedFirst = [
        "abandon", "ability", "able", "about", "above",
        "absent", "absorb", "abstract", "absurd", "abuse"
    ];

    // Last word
    string expectedLast = "zoo";

    function setUp() public {
        deployer = new BIP39WordsDataDeployer();

        // Build packed test data (first 20 + last word for basic test)
        // For full test, we'd need all 2048 words packed
        // For now, test with a small subset
        bytes memory packed = _packWords();
        address dataAddr = deployer.deploy(packed);
        bip39 = new BIP39Words(dataAddr);
    }

    function _packWords() internal pure returns (bytes memory) {
        // Pack just a few words for unit testing
        string[12] memory words = [
            "abandon", "ability", "able", "about", "above",
            "absent", "absorb", "abstract", "absurd", "abuse",
            "access", "accident"
        ];
        
        bytes memory result;
        for (uint i = 0; i < words.length; i++) {
            bytes memory w = bytes(words[i]);
            result = abi.encodePacked(result, uint8(w.length), w);
        }
        return result;
    }

    function test_wordCount() public view {
        assertEq(bip39.WORD_COUNT(), 2048);
    }

    function test_firstWord() public view {
        assertEq(bip39.word(0), "abandon");
    }

    function test_secondWord() public view {
        assertEq(bip39.word(1), "ability");
    }

    function test_thirdWord() public view {
        assertEq(bip39.word(2), "able");
    }

    function test_tenthWord() public view {
        assertEq(bip39.word(9), "abuse");
    }

    function test_revert_outOfBounds() public {
        vm.expectRevert("Index out of bounds");
        bip39.word(2048);
    }

    function test_dataContractSet() public view {
        assertTrue(bip39.dataContract() != address(0));
    }
}
