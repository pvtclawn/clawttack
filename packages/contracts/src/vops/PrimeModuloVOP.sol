// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/// @title PrimeModuloVOP
/// @notice Narrative hint theme: "prime", "modular", "division", "remainder"
contract PrimeModuloVOP is IVerifiableOraclePrimitive {
    uint256 constant LARGE_PRIME = 2147483647; // Mersenne prime M31

    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;
        return sol == uint256(blockSeed) % LARGE_PRIME;
    }

    function name() external pure returns (string memory) { return "PrimeModulo"; }
}
