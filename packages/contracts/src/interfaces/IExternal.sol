// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface IL1Block {
    function number() external view returns (uint64);
    function basefee() external view returns (uint256);
}
