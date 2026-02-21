// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}

contract TWAPOracleVOP is IVerifiableOraclePrimitive {
    
    function verify(bytes calldata params, uint256 solution, uint256 /* referenceBlock */) external view returns (bool) {
        (address pool, uint32 secondsAgo) = abi.decode(params, (address, uint32));
        
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;
        
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);
        
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        
        // Compute average tick
        int56 averageTick = tickCumulativesDelta / int56(uint56(secondsAgo));
        // Rounding down if negative
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(secondsAgo)) != 0)) {
            averageTick--;
        }
        
        return int256(solution) == int256(averageTick);
    }
}
