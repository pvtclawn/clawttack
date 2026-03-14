// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title PopCountVOP
/// @notice Narrative hint theme: "count", "population", "bits", "density", "weight"
/// @dev Solution = number of set bits (popcount) in the blockhash.
contract PopCountVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        // Count set bits in blockhash
        uint256 v = uint256(blockSeed);
        uint256 count;
        while (v != 0) {
            count += v & 1;
            v >>= 1;
        }
        return sol == count;
    }

    function name() external pure returns (string memory) { return "PopCount"; }
}
