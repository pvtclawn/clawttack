// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BIP39 English Wordlist (2048 words)
/// @notice On-chain BIP39 wordlist stored as contract bytecode via SSTORE2 pattern
/// @dev Deploy BIP39WordsData first, then pass its address to this contract
contract BIP39Words {
    uint16 public constant WORD_COUNT = 2048;

    /// @notice Address of the data contract containing packed BIP39 words
    address public immutable dataContract;

    constructor(address _dataContract) {
        dataContract = _dataContract;
    }

    /// @notice Get a word by index (0-2047)
    /// @param index The word index
    /// @return The BIP39 word at the given index
    function word(uint16 index) external view returns (string memory) {
        require(index < WORD_COUNT, "Index out of bounds");

        // Read packed data from the data contract's bytecode
        // Format: [1-byte length][word bytes] repeated 2048 times
        // First byte of the data contract is 0x00 (STOP opcode, SSTORE2 pattern)
        bytes memory packed = _readData();

        // Walk through length-prefixed entries
        uint256 pos = 0;
        for (uint16 i = 0; i < index; i++) {
            pos += uint8(packed[pos]) + 1;
        }

        uint8 len = uint8(packed[pos]);
        bytes memory result = new bytes(len);
        for (uint8 j = 0; j < len; j++) {
            result[j] = packed[pos + 1 + j];
        }
        return string(result);
    }

    /// @dev Read the full bytecode of the data contract (minus the STOP prefix)
    function _readData() private view returns (bytes memory data) {
        address addr = dataContract;
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        require(size > 1, "No data");

        // Skip first byte (STOP opcode)
        uint256 dataSize = size - 1;
        data = new bytes(dataSize);
        assembly {
            extcodecopy(addr, add(data, 32), 1, dataSize)
        }
    }
}
