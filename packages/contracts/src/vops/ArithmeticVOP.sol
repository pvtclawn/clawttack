// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IVerifiableOraclePrimitive} from "../interfaces/IVerifiableOraclePrimitive.sol";

/**
 * @title ArithmeticVOP
 * @notice Instance-aware VOP: attacker embeds two numbers and an operation in the narrative.
 *
 * Flow:
 *   1. Attacker picks a=42, b=7, op=MUL, computes instanceCommit = keccak256(abi.encode(42, 7, 1))
 *   2. Attacker writes narrative: "42 warriors split into groups of 7, their power MULTIPLIED..."
 *   3. Solver reads narrative, extracts (42, 7, MUL), computes 42*7=294
 *   4. Solver submits solution = abi.encode(294, 42, 7, 1)
 *   5. Contract verifies: keccak256(abi.encode(42,7,1)) == instanceCommit? 42*7 == 294? blockhash valid?
 *
 * A script that doesn't understand the narrative would need to brute-force all possible
 * (a, b, op) combinations — which is infinite.
 *
 * Narrative hint theme: numbers, arithmetic, "calculate", "combine", "split"
 */
contract ArithmeticVOP is IVerifiableOraclePrimitive {
    // Operations
    uint8 constant OP_ADD = 0;
    uint8 constant OP_MUL = 1;
    uint8 constant OP_SUB = 2;
    uint8 constant OP_XOR = 3;
    uint8 constant OP_MOD = 4;

    function verify(
        bytes calldata params,
        bytes calldata solution,
        uint256 /* referenceBlock */
    ) external view returns (bool) {
        // params = abi.encode(uint64 blockNumber, bytes32 instanceCommit)
        (uint64 blockNumber, bytes32 instanceCommit) = abi.decode(params, (uint64, bytes32));

        // Must have an instance commitment (this VOP requires it)
        if (instanceCommit == bytes32(0)) return false;

        bytes32 blockSeed = blockhash(blockNumber);
        if (blockSeed == bytes32(0)) return false;

        // solution = abi.encode(uint256 answer, uint256 a, uint256 b, uint8 op)
        (uint256 answer, uint256 a, uint256 b, uint8 op) = abi.decode(
            solution, (uint256, uint256, uint256, uint8)
        );

        // Verify instance params match the commitment
        if (keccak256(abi.encode(a, b, op)) != instanceCommit) return false;

        // Compute expected answer: operation(a, b) XOR'd with blockSeed for uniqueness
        uint256 rawResult;
        if (op == OP_ADD) rawResult = a + b;
        else if (op == OP_MUL) rawResult = a * b;
        else if (op == OP_SUB) rawResult = a > b ? a - b : b - a; // abs diff
        else if (op == OP_XOR) rawResult = a ^ b;
        else if (op == OP_MOD && b != 0) rawResult = a % b;
        else return false; // invalid operation

        // Mix with block seed so same instance params produce different answers per block
        uint256 expected = uint256(keccak256(abi.encode(rawResult, blockSeed)));

        return answer == expected;
    }

    function name() external pure returns (string memory) {
        return "Arithmetic";
    }
}
