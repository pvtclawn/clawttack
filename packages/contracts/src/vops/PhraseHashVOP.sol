// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/**
 * @title PhraseHashVOP
 * @notice Instance-aware VOP: attacker embeds a multi-word passphrase in the narrative.
 *
 * Flow:
 *   1. Attacker picks phrase = "the moon rises twice"
 *   2. instanceCommit = keccak256(abi.encode("the moon rises twice"))
 *   3. Narrative: "Under starlight, THE MOON RISES TWICE over the ancient battlefield..."
 *   4. Solver identifies the passphrase from emphasis/caps/context
 *   5. solution = abi.encode(hash, "the moon rises twice")
 *
 * Harder than KeywordHashVOP because the search space is multi-word phrases,
 * not single words. Requires deeper narrative comprehension.
 *
 * Theme: "phrase", "passphrase", "incantation", "spell", "mantra"
 */
contract PhraseHashVOP is IVerifiableOraclePrimitive {
    function verify(
        bytes calldata params,
        bytes calldata solution,
        uint256 /* referenceBlock */
    ) external view returns (bool) {
        (uint64 blockNumber, bytes32 instanceCommit) = abi.decode(params, (uint64, bytes32));

        if (instanceCommit == bytes32(0)) return false;
        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        // solution = abi.encode(uint256 answer, string phrase)
        (uint256 answer, string memory phrase) = abi.decode(solution, (uint256, string));

        // Verify phrase matches commitment
        if (keccak256(abi.encode(phrase)) != instanceCommit) return false;

        // Compute expected: hash(phrase, blockSeed, phrase.length) — length adds a dimension
        uint256 expected = uint256(keccak256(abi.encode(phrase, blockSeed, bytes(phrase).length)));

        return answer == expected;
    }

    function name() external pure returns (string memory) { return "PhraseHash"; }
}
