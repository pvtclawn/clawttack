// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";
import {IL1Block, IUniswapV3Pool} from "../interfaces/IExternal.sol";

contract CrossChainSyncVOP is IVerifiableOraclePrimitive {
    address constant L1_BLOCK_PREDEPLOY = 0x4200000000000000000000000000000000000015;

    function verify(bytes calldata params, uint256 solution, uint256 /* referenceBlock */) external view returns (bool) {
        (address pool, uint32 secondsAgo) = abi.decode(params, (address, uint32));
        
        uint256 l1BaseFee = IL1Block(L1_BLOCK_PREDEPLOY).basefee();
        
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;
        
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        
        int56 averageTick = tickCumulativesDelta / int56(uint56(secondsAgo));
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(secondsAgo)) != 0)) {
            averageTick--;
        }
        
        uint256 expected = l1BaseFee ^ uint256(int256(averageTick));
        return solution == expected;
    }
}
