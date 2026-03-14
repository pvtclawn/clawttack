// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/**
 * @title CoordinateVOP
 * @notice Instance-aware VOP: attacker embeds two coordinate pairs in the narrative.
 *
 * Flow:
 *   1. Attacker picks (x1=3, y1=4, x2=6, y2=8)
 *   2. instanceCommit = keccak256(abi.encode(3, 4, 6, 8))
 *   3. Narrative: "The treasure lies 3 leagues north and 4 leagues east...
 *      but the dragon guards it 6 leagues north and 8 leagues east..."
 *   4. Solver extracts coords, computes Manhattan distance = |6-3| + |8-4| = 7
 *   5. solution = abi.encode(hash(7, blockSeed), 3, 4, 6, 8)
 *
 * Theme: "distance", "journey", "coordinates", "map", "treasure"
 */
contract CoordinateVOP is IVerifiableOraclePrimitive {
    function verify(
        bytes calldata params,
        bytes calldata solution,
        uint256 /* referenceBlock */
    ) external view returns (bool) {
        (uint64 blockNumber, bytes32 instanceCommit) = abi.decode(params, (uint64, bytes32));

        if (instanceCommit == bytes32(0)) return false;
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        // solution = abi.encode(uint256 answer, uint256 x1, uint256 y1, uint256 x2, uint256 y2)
        (uint256 answer, uint256 x1, uint256 y1, uint256 x2, uint256 y2) = abi.decode(
            solution, (uint256, uint256, uint256, uint256, uint256)
        );

        // Verify instance params match commitment
        if (keccak256(abi.encode(x1, y1, x2, y2)) != instanceCommit) return false;

        // Manhattan distance
        uint256 dx = x1 > x2 ? x1 - x2 : x2 - x1;
        uint256 dy = y1 > y2 ? y1 - y2 : y2 - y1;
        uint256 distance = dx + dy;

        // Mix with block seed
        uint256 expected = uint256(keccak256(abi.encode(distance, blockSeed)));

        return answer == expected;
    }

    function name() external pure returns (string memory) { return "Coordinate"; }
}
