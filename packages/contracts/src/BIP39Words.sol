// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title BIP39 English Wordlist (on-chain via SSTORE2)
/// @notice On-chain wordlist stored as contract bytecode via SSTORE2 pattern
/// @dev Deploy packed word data first, then pass its address to this contract.
///      Packed format: repeated [1-byte length][word bytes] entries.
contract BIP39Words {
    /// @notice Number of words in the wordlist
    uint16 public immutable WORD_COUNT;

    /// @notice Address of the data contract containing packed words
    address public immutable dataContract;

    /// @param _dataContract Address of the SSTORE2 data contract
    /// @param _wordCount Number of words packed in the data
    constructor(address _dataContract, uint16 _wordCount) {
        dataContract = _dataContract;
        WORD_COUNT = _wordCount;
    }

    /// @notice Get a word by index
    /// @param index The word index (0 to WORD_COUNT-1)
    /// @return The word at the given index
    function word(uint16 index) external view returns (string memory) {
        require(index < WORD_COUNT, "Index out of bounds");

        bytes memory packed = _readData();

        // Walk through length-prefixed entries to find target
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

        uint256 dataSize = size - 1;
        data = new bytes(dataSize);
        assembly {
            extcodecopy(addr, add(data, 32), 1, dataSize)
        }
    }
}
