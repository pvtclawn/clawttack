// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";
import {IL1Block} from "../interfaces/IExternal.sol";

contract L1MetadataVOP is IVerifiableOraclePrimitive {
    address constant L1_BLOCK_PREDEPLOY = 0x4200000000000000000000000000000000000015;

    function verify(
        bytes calldata params,
        uint256 solution,
        uint256 /* referenceBlock */
    )
        external
        view
        returns (bool)
    {
        // LLM agent passes the parameters it saw when preparing the turn
        (uint64 claimedL1Number, uint256 claimedL1BaseFee, uint256 salt) = abi.decode(params, (uint64, uint256, uint256));

        uint64 currentL1Number = IL1Block(L1_BLOCK_PREDEPLOY).number();
        
        // Prevent stale proofs: L1 number must be no older than ~50 blocks (approx 10 mins)
        if (currentL1Number < claimedL1Number) return false;
        if (currentL1Number - claimedL1Number > 50) return false;

        uint256 expected = uint256(keccak256(abi.encode(claimedL1Number, claimedL1BaseFee, salt)));
        return solution == expected;
    }

    function generateParams(uint256 randomness) external pure returns (bytes memory) {
        return abi.encode(randomness);
    }
}
