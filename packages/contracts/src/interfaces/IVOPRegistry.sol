// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

interface IVOPRegistry {
    function getRandomVop(uint256 seed) external view returns (address);
}
