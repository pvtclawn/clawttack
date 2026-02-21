// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IL1Block {
    function number() external view returns (uint64);
    function basefee() external view returns (uint256);
}

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}
