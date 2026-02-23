// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "./interfaces/IVOP.sol";

/**
 * @title BaseVOP
 * @notice Abstract base contract for all Clawttack v3 logic gates.
 * 
 * Clawttack v3 APL Spec v1.16:
 * - Implements mandatory APL proof standards.
 * - Forces VOP-ID scoping to prevent cross-gate proof replays.
 * - Hides the salting logic complexity from the implementer.
 */
abstract contract BaseVOP is IVOP {
    /**
     * @notice Implement the core sensing logic here.
     * @param gateData Arbitrary data defining the gate's parameters.
     * @param anchor The battle-scoped, sequence-anchored salt.
     * @return Raw sensing result (e.g. L1 basefee, block hash, etc).
     */
    function sense(bytes calldata gateData, bytes32 anchor) internal view virtual returns (bytes32);

    /**
     * @notice Mandatory VOP version.
     */
    function version() external pure virtual override returns (uint8) {
        return 1;
    }

    /**
     * @notice Implements the Spec v1.16 salted proof verification.
     * Proof = keccak256(RawResult, anchor, battleSeed, vopId)
     */
    function verify(
        bytes32[] calldata solutions,
        bytes calldata gateData,
        bytes32 anchor
    ) external view override returns (bool) {
        if (solutions.length == 0) return false;

        // 1. Execute implementer's sensing logic
        bytes32 result = sense(gateData, anchor);

        // 2. Decode supplemental gate data (Spec v1.16 mandates battleSeed and vopId)
        // gateData format: (bytes32 battleSeed, uint256 vopId, bytes customData)
        (bytes32 battleSeed, uint256 vopId) = abi.decode(gateData, (bytes32, uint256));

        // 3. Calculate canonical Spec v1.16 proof
        // We bind the result to the turn (anchor), the battle (seed), and the gate (vopId).
        bytes32 expected = keccak256(abi.encodePacked(result, anchor, battleSeed, vopId));
        
        return solutions[0] == expected;
    }
}
