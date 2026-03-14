// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title CascadeHashVOP
/// @notice Narrative hint theme: "waterfall", "cascade", "layers", "depth"
contract CascadeHashVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;
        bytes32 h = keccak256(abi.encode(blockSeed));
        h = keccak256(abi.encode(h));
        h = keccak256(abi.encode(h));
        return sol == uint256(h);
    }

    function name() external pure returns (string memory) { return "CascadeHash"; }
}
