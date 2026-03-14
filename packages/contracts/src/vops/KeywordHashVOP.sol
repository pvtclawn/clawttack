// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/**
 * @title KeywordHashVOP
 * @notice Instance-aware VOP: attacker embeds a secret keyword in the narrative.
 *
 * Flow:
 *   1. Attacker picks keyword="phoenix", computes instanceCommit = keccak256(abi.encode("phoenix"))
 *   2. Attacker writes narrative: "From the ashes, the PHOENIX rises with blazing wings..."
 *   3. Solver reads narrative, identifies the keyword "phoenix"
 *   4. Solver submits solution = abi.encode(hash, "phoenix") where hash = keccak256("phoenix", blockSeed)
 *   5. Contract verifies: keccak256(abi.encode("phoenix")) == instanceCommit? hash correct?
 *
 * A script cannot brute-force which word in the narrative is "the keyword" —
 * the entire English language is the search space. Only narrative comprehension
 * (understanding emphasis, context, thematic weight) reveals the answer.
 *
 * Narrative hint theme: emphasis, repetition, capitalization, thematic centrality
 */
contract KeywordHashVOP is IVerifiableOraclePrimitive {
    function verify(
        bytes calldata params,
        bytes calldata solution,
        uint256 /* referenceBlock */
    ) external view returns (bool) {
        // params = abi.encode(uint64 blockNumber, bytes32 instanceCommit)
        (uint64 blockNumber, bytes32 instanceCommit) = abi.decode(params, (uint64, bytes32));

        // Must have an instance commitment
        if (instanceCommit == bytes32(0)) return false;

        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        // solution = abi.encode(uint256 answer, string keyword)
        (uint256 answer, string memory keyword) = abi.decode(solution, (uint256, string));

        // Verify the keyword matches the committed instance
        if (keccak256(abi.encode(keyword)) != instanceCommit) return false;

        // Verify the answer is hash(keyword, blockSeed)
        uint256 expected = uint256(keccak256(abi.encode(keyword, blockSeed)));

        return answer == expected;
    }

    function name() external pure returns (string memory) {
        return "KeywordHash";
    }
}
