// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/**
 * @title HashPreimageVOP
 * @notice Hash preimage puzzle using block number as seed.
 * @dev Challenge: find `x` such that keccak256(blockHash, x) has N leading zero bits.
 *      N = 8 + (blockNumber % 4) → difficulty range [8, 11].
 *      The block hash anchors the puzzle to a specific block, making it
 *      impossible to pre-compute solutions before the block is produced.
 */
contract HashPreimageVOP is IVerifiableOraclePrimitive {
    function verify(
        bytes calldata params,
        uint256 solution,
        uint256 /* referenceBlock */
    )
        external
        view
        returns (bool)
    {
        uint64 blockNumber = abi.decode(params, (uint64));

        // Use blockhash as the puzzle seed (only available for last 256 blocks)
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) {
            // Block too old or in the future — cannot verify, fail safely
            return false;
        }

        // Difficulty: 8 to 11 leading zero bits
        uint8 leadingZeroBits = uint8(8 + (blockNumber % 4));

        bytes32 hash = keccak256(abi.encode(blockSeed, solution));

        if (leadingZeroBits >= 256) return false;
        return (uint256(hash) >> (256 - leadingZeroBits)) == 0;
    }

    function name() external pure returns (string memory) {
        return "HashPreimage";
    }
}
