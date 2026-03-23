// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ChessClockLib} from "../src/libraries/ChessClockLib.sol";
import {NccVerifier} from "../src/libraries/NccVerifier.sol";
import {ClawttackTypes} from "../src/libraries/ClawttackTypes.sol";

/// @notice Minimal harness testing ChessClockLib.applyVopResult + VOP commit-reveal
///         isolated from the full battle contract. Tests the Constant Relative Advantage
///         penalty matrix.
contract VopHarness {
    using ChessClockLib for ChessClockLib.Clock;
    ChessClockLib.Clock public clock;
    ClawttackTypes.GameConfig public gameConfig;

    function init() external {
        gameConfig = ClawttackTypes.GameConfig({
            initialBank: 400,
            nccRefundBps: 5000,
            nccFailPenalty: 20,
            bankDecayBps: 200,
            minTurnInterval: 5,
            maxTurnTimeout: 80,
            vopPenaltyBase: 15,
            defaultEloRating: 1500,
            maxEloDiff: 300,
            warmupBlocks: 30,
            maxJokers: 2
        });
        clock.init(gameConfig);
    }

    /// @notice Set banks directly for targeted penalty tests
    function setBanks(uint128 a, uint128 b) external {
        clock.bankA = a;
        clock.bankB = b;
    }

    function getBanks() external view returns (uint128, uint128) {
        return (clock.bankA, clock.bankB);
    }

    /// @notice Apply a VOP result and return bank deltas
    function applyVop(
        bool isChallengerA,
        ClawttackTypes.VopOutcome outcome
    ) external returns (bool cDepleted, bool sDepleted) {
        return clock.applyVopResult(isChallengerA, outcome, gameConfig);
    }

    /// @notice Verify VOP commitment scheme
    function computeVopCommitment(
        uint256 battleId,
        uint32 turnNumber,
        bytes32 salt,
        uint8 vopIndex,
        bytes32 instanceCommit
    ) external pure returns (bytes32) {
        return NccVerifier.computeVopCommitment(battleId, turnNumber, salt, vopIndex, instanceCommit);
    }
}

contract VopIntegrationTest is Test {
    VopHarness harness;

    uint256 constant X = 15; // matches gameConfig.vopPenaltyBase

    function setUp() public {
        harness = new VopHarness();
        harness.init();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Penalty Matrix Tests (Constant Relative Advantage)
    // ═══════════════════════════════════════════════════════════════════════════

    /// NccGateFailed: challenger −3X, solver −X, net −2X
    function test_penalty_nccGateFailed() public {
        harness.setBanks(200, 200);
        (bool cDepl, bool sDepl) = harness.applyVop(true, ClawttackTypes.VopOutcome.NccGateFailed);

        (uint128 bankA, uint128 bankB) = harness.getBanks();
        // A is challenger: −3X = −45
        assertEq(bankA, 200 - 3 * X, "challenger bank: -3X");
        // B is solver: −X = −15
        assertEq(bankB, 200 - X, "solver bank: -X");
        assertFalse(cDepl);
        assertFalse(sDepl);

        // Net advantage: challenger lost 2X more than solver
        assertEq((200 - bankA) - (200 - bankB), 2 * X, "net = -2X");
    }

    /// WrongIndex: challenger −3X, solver −X, net −2X
    function test_penalty_wrongIndex() public {
        harness.setBanks(200, 200);
        harness.applyVop(true, ClawttackTypes.VopOutcome.WrongIndex);

        (uint128 bankA, uint128 bankB) = harness.getBanks();
        assertEq(bankA, 200 - 3 * X, "challenger bank: -3X");
        assertEq(bankB, 200 - X, "solver bank: -X");
    }

    /// RightIndexWrongSol: challenger 0, solver −2X
    function test_penalty_rightIndexWrongSol() public {
        harness.setBanks(200, 200);
        harness.applyVop(true, ClawttackTypes.VopOutcome.RightIndexWrongSol);

        (uint128 bankA, uint128 bankB) = harness.getBanks();
        assertEq(bankA, 200, "challenger bank: unchanged");
        assertEq(bankB, 200 - 2 * X, "solver bank: -2X");
    }

    /// RightIndexRightSol: challenger −X, solver +X, net −2X
    function test_penalty_rightIndexRightSol() public {
        harness.setBanks(200, 200);
        harness.applyVop(true, ClawttackTypes.VopOutcome.RightIndexRightSol);

        (uint128 bankA, uint128 bankB) = harness.getBanks();
        assertEq(bankA, 200 - X, "challenger bank: -X");
        assertEq(bankB, 200 + X, "solver bank: +X");
        assertEq((200 - bankA) - (bankB - 200), 0, "symmetric: challenger loses X, solver gains X");
    }

    /// Solver refund capped at INITIAL_BANK
    function test_penalty_solverRefundCap() public {
        harness.setBanks(200, 395);
        harness.applyVop(true, ClawttackTypes.VopOutcome.RightIndexRightSol);

        (, uint128 bankB) = harness.getBanks();
        assertEq(bankB, 400, "solver bank capped at INITIAL_BANK");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Bank Depletion on VOP Penalties
    // ═══════════════════════════════════════════════════════════════════════════

    /// Challenger bank depleted by VOP penalty
    function test_depletion_challengerBankEmpty() public {
        harness.setBanks(10, 200); // challenger has only 10 blocks
        (bool cDepl,) = harness.applyVop(true, ClawttackTypes.VopOutcome.NccGateFailed);

        (uint128 bankA,) = harness.getBanks();
        assertEq(bankA, 0, "challenger bank zeroed");
        assertTrue(cDepl, "challenger depleted");
    }

    /// Solver bank depleted by VOP penalty
    function test_depletion_solverBankEmpty() public {
        harness.setBanks(200, 5); // solver has only 5 blocks
        (, bool sDepl) = harness.applyVop(true, ClawttackTypes.VopOutcome.WrongIndex);

        (, uint128 bankB) = harness.getBanks();
        assertEq(bankB, 0, "solver bank zeroed");
        assertTrue(sDepl, "solver depleted");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Reversed Polarity (B as challenger, A as solver)
    // ═══════════════════════════════════════════════════════════════════════════

    /// When B is challenger, penalties apply to B's bank as challenger
    function test_penalty_reversedPolarity() public {
        harness.setBanks(200, 200);
        harness.applyVop(false, ClawttackTypes.VopOutcome.NccGateFailed);

        (uint128 bankA, uint128 bankB) = harness.getBanks();
        // B is challenger: −3X
        assertEq(bankB, 200 - 3 * X, "B (challenger): -3X");
        // A is solver: −X
        assertEq(bankA, 200 - X, "A (solver): -X");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VOP Commitment Scheme
    // ═══════════════════════════════════════════════════════════════════════════

    /// Domain-separated VOP commitment is deterministic
    function test_vopCommitment_deterministic() public {
        bytes32 c1 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        bytes32 c2 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        assertEq(c1, c2, "same inputs = same commitment");
    }

    /// Different battleId → different commitment
    function test_vopCommitment_battleIdBound() public {
        bytes32 c1 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        bytes32 c2 = harness.computeVopCommitment(2, 0, bytes32(uint256(42)), 0, bytes32(0));
        assertTrue(c1 != c2, "different battleId = different commitment");
    }

    /// Different turn → different commitment
    function test_vopCommitment_turnBound() public {
        bytes32 c1 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        bytes32 c2 = harness.computeVopCommitment(1, 2, bytes32(uint256(42)), 0, bytes32(0));
        assertTrue(c1 != c2, "different turn = different commitment");
    }

    /// Different index → different commitment
    function test_vopCommitment_indexBound() public {
        bytes32 c1 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        bytes32 c2 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 1, bytes32(0));
        assertTrue(c1 != c2, "different index = different commitment");
    }

    /// Different salt → different commitment
    function test_vopCommitment_saltBound() public {
        bytes32 c1 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        bytes32 c2 = harness.computeVopCommitment(1, 0, bytes32(uint256(99)), 0, bytes32(0));
        assertTrue(c1 != c2, "different salt = different commitment");
    }

    /// Different instanceCommit → different commitment
    function test_vopCommitment_instanceBound() public {
        bytes32 c1 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, bytes32(0));
        bytes32 c2 = harness.computeVopCommitment(1, 0, bytes32(uint256(42)), 0, keccak256("instance_params"));
        assertTrue(c1 != c2, "different instanceCommit = different commitment");
    }
}
