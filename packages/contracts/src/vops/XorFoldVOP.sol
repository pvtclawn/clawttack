// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title XorFoldVOP
/// @notice Narrative hint theme: "fold", "origami", "compress", "overlap"
contract XorFoldVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;
        uint256 seed = uint256(blockSeed);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 high = uint128(seed >> 128);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 low = uint128(seed);
        return sol == uint256(high ^ low);
    }

    function name() external pure returns (string memory) { return "XorFold"; }
}
