// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

interface IL1Block {
    function number() external view returns (uint64);
    function basefee() external view returns (uint256);
}

contract L1MetadataVOP is IVerifiableOraclePrimitive {
    address constant L1_BLOCK_PREDEPLOY = 0x4200000000000000000000000000000000000015;

    function verify(bytes calldata params, uint256 solution, uint256 /* referenceBlock */) external view returns (bool) {
        uint256 salt = abi.decode(params, (uint256));
        
        uint64 l1Number = IL1Block(L1_BLOCK_PREDEPLOY).number();
        uint256 l1BaseFee = IL1Block(L1_BLOCK_PREDEPLOY).basefee();
        
        uint256 expected = uint256(keccak256(abi.encode(l1Number, l1BaseFee, salt)));
        return solution == expected;
    }
}
