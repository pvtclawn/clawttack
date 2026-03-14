// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title TimestampHashVOP
/// @notice Narrative hint theme: "time", "clock", "moment", "temporal"
contract TimestampHashVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;
        return sol == uint256(keccak256(abi.encode(blockSeed, blockNumber, "TIME")));
    }

    function name() external pure returns (string memory) { return "TimestampHash"; }
}
