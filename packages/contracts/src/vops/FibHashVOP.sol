// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title FibHashVOP
/// @notice Narrative hint theme: "fibonacci", "spiral", "golden", "sequence", "growth"
/// @dev Derives two seed values from blockhash, runs a short Fibonacci-like iteration,
///      solution = final value mod 2^128.
contract FibHashVOP is IVerifiableOraclePrimitive {
    uint256 constant ITERATIONS = 10;

    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        uint256 seed = uint256(blockSeed);
        uint256 a = seed >> 128;          // high 128 bits
        uint256 b = seed & type(uint128).max; // low 128 bits

        unchecked {
            for (uint256 i = 0; i < ITERATIONS; i++) {
                uint256 next = a + b;
                a = b;
                b = next;
            }
        }
        return sol == b;
    }

    function name() external pure returns (string memory) { return "FibHash"; }
}
