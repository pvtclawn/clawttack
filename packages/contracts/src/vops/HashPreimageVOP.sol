// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

contract HashPreimageVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata params, uint256 solution, uint256 /* referenceBlock */) external pure returns (bool) {
        (bytes32 salt, uint8 leadingZeroBits) = abi.decode(params, (bytes32, uint8));
        
        bytes32 hash = keccak256(abi.encode(salt, solution));
        
        if (leadingZeroBits >= 256) return false;
        
        return (uint256(hash) >> (256 - leadingZeroBits)) == 0;
    }
}
