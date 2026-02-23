// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface IWordDictionary {
    function word(uint16 index) external view returns (string memory);
    function wordCount() external view returns (uint16);
}
