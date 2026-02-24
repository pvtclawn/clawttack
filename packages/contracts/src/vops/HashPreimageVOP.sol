// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

contract HashPreimageVOP is IVerifiableOraclePrimitive {
    function verify(
        bytes calldata params,
        uint256 solution,
        uint256 /* referenceBlock */
    )
        external
        pure
        returns (bool)
    {
        if (params.length == 0) return true; // Turn 0: no VOP params set yet

        (bytes32 salt, uint8 leadingZeroBits) = abi.decode(params, (bytes32, uint8));

        bytes32 hash = keccak256(abi.encode(salt, solution));

        if (leadingZeroBits >= 256) return false;

        return (uint256(hash) >> (256 - leadingZeroBits)) == 0;
    }

    function generateParams(uint256 randomness) external pure returns (bytes memory) {
        bytes32 salt = bytes32(randomness);
        uint8 leadingZeros = uint8((randomness % 4) + 8); // 8 to 11 zeros
        return abi.encode(salt, leadingZeros);
    }
}
