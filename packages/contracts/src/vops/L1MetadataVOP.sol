// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";
import {IL1Block} from "../interfaces/IExternal.sol";

/**
 * @title L1MetadataVOP
 * @notice L1 block metadata puzzle using block number as seed.
 * @dev Challenge: compute keccak256(l1Number, l1BaseFee, blockhash(blockNumber)).
 */
contract L1MetadataVOP is IVerifiableOraclePrimitive {
    address constant L1_BLOCK_PREDEPLOY = 0x4200000000000000000000000000000000000015;

    function verify(bytes calldata params, bytes calldata solution, uint256) external view returns (bool) {
        uint64 blockNumber = abi.decode(params, (uint64));
        uint256 sol = abi.decode(solution, (uint256));

        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        uint64 l1Number = IL1Block(L1_BLOCK_PREDEPLOY).number();
        uint256 l1BaseFee = IL1Block(L1_BLOCK_PREDEPLOY).basefee();

        uint256 expected = uint256(keccak256(abi.encode(l1Number, l1BaseFee, blockSeed)));
        return sol == expected;
    }

    function name() external pure returns (string memory) { return "L1Metadata"; }
}
