// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title SequenceHashVOP
/// @notice Narrative hint theme: "sequence", "chain", "linked", "predecessor"
contract SequenceHashVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        if (blockNumber == 0) return false;
        bytes32 blockSeed = blockhash(blockNumber);
        bytes32 prevSeed = blockhash(blockNumber - 1);
        if (blockSeed == bytes32(0) || prevSeed == bytes32(0)) return false;
        return sol == uint256(keccak256(abi.encode(blockSeed, prevSeed)));
    }

    function name() external pure returns (string memory) { return "SequenceHash"; }
}
