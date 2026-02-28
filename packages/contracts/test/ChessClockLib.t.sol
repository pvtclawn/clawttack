// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ChessClockLib} from "../src/libraries/ChessClockLib.sol";

/**
 * @title ChessClockLibTest
 * @notice Tests all invariants from V4D-INVARIANTS.md (CC1-CC6).
 */
contract ChessClockLibTest is Test {
    using ChessClockLib for ChessClockLib.Clock;

    ChessClockLibHarness public harness;

    function setUp() public {
        harness = new ChessClockLibHarness();
        harness.init();
    }

    // ─── CC2: Decay guarantees termination ──────────────────────────────────

    function test_init_sets_banks() public view {
        (uint128 a, uint128 b,) = harness.getClock();
        assertEq(a, 400, "initial bank A");
        assertEq(b, 400, "initial bank B");
    }

    function test_turn_deducts_time() public {
        vm.roll(block.number + 10);
        harness.tick(true, true, true); // agent A, first turn
        (uint128 bankA,,) = harness.getClock();
        // bank = 400 - 10 (turn) - decay(~7) = ~383
        assertLt(bankA, 400, "bank should decrease");
        assertGt(bankA, 370, "bank shouldn't decrease too much");
    }

    // ─── CC4: Min interval prevents speed exploits ──────────────────────────

    function test_revert_too_fast() public {
        vm.roll(block.number + 2); // < MIN_TURN_INTERVAL (5)
        vm.expectRevert(ChessClockLib.TurnTooFast.selector);
        harness.tick(true, true, true);
    }

    function test_min_interval_accepted() public {
        vm.roll(block.number + 5); // exactly MIN_TURN_INTERVAL
        harness.tick(true, true, true);
        (uint128 bankA,,) = harness.getClock();
        assertGt(bankA, 0);
    }

    // ─── CC3: NCC penalty scales correctly ──────────────────────────────────

    function test_ncc_success_refunds() public {
        uint256 b = block.number;
        vm.roll(b + 10);
        harness.tick(true, true, true); // first turn, no NCC
        (uint128 bankAfterFirst,,) = harness.getClock();

        vm.roll(b + 20);
        harness.tick(true, true, false); // NCC success, refund 10 blocks
        (uint128 bankAfterRefund,,) = harness.getClock();

        // With 100% refund, bank should be close to bankAfterFirst minus decay only
        // The refund compensates for the turn time deduction
        assertGt(bankAfterRefund, bankAfterFirst - 20, "refund should keep bank high");
    }

    function test_ncc_failure_penalty() public {
        uint256 b = block.number;
        vm.roll(b + 10);
        harness.tick(true, true, true); // first turn
        (uint128 bankAfterFirst,,) = harness.getClock();

        vm.roll(b + 20);
        harness.tick(true, false, false); // NCC failure → -20 penalty
        (uint128 bankAfterPenalty,,) = harness.getClock();

        // Bank should be significantly lower: -10 (time) - decay - 20 (penalty)
        assertLt(bankAfterPenalty, bankAfterFirst - 25, "penalty should drain bank fast");
    }

    // ─── CC1: Bank monotonically bounded ────────────────────────────────────

    function test_bank_capped_at_initial() public {
        uint256 b = block.number;
        // Even with huge refunds, bank shouldn't exceed INITIAL_BANK
        b += 5;
        vm.roll(b);
        harness.tick(true, true, true); // first turn

        // Now simulate many successful NCC turns with minimal time
        for (uint256 i = 0; i < 20; i++) {
            b += 5;
            vm.roll(b);
            harness.tick(true, true, false); // NCC success with 5 block refund
        }
        (uint128 bankA,,) = harness.getClock();
        assertLe(bankA, 400, "bank must not exceed INITIAL_BANK");
    }

    // ─── CC5: Bank floor prevents underflow ─────────────────────────────────

    function test_bank_floors_at_zero() public {
        // Drain bank via many NCC failures
        uint256 b = block.number;
        for (uint256 i = 0; i < 50; i++) {
            b += 5;
            vm.roll(b);
            bool isFirst = (i == 0);
            (, bool depleted) = harness.tick(true, isFirst, isFirst);
            if (depleted) {
                (uint128 bankA,,) = harness.getClock();
                assertEq(bankA, 0, "bank should be 0 on depletion");
                return;
            }
        }
        fail("Expected bank depletion within 50 turns of NCC failures");
    }

    // ─── CC6: Trivial riddles don't help ─────────────────────────────────────
    // (This is verified by simulation, not unit test — see ncc-battle-sim-v4-edge.ts)

    // ─── Script economy: drains ~4x faster than LLM ─────────────────────────

    function test_script_drains_faster_than_llm() public {
        // Script: 5 block turns, always NCC fail (worst case for script)
        ChessClockLibHarness scriptH = new ChessClockLibHarness();
        scriptH.init();

        uint256 scriptTurns = 0;
        uint256 b = block.number;
        for (uint256 i = 0; i < 200; i++) {
            b += 5;
            vm.roll(b);
            bool isFirst = (i == 0);
            (, bool depleted) = scriptH.tick(true, isFirst, isFirst);
            scriptTurns = i + 1;
            if (depleted) break;
        }

        // LLM: 10 block turns, always NCC success (best case for LLM)
        ChessClockLibHarness llmH = new ChessClockLibHarness();
        llmH.init();

        uint256 llmTurns = 0;
        b = block.number;
        for (uint256 i = 0; i < 200; i++) {
            b += 10;
            vm.roll(b);
            (, bool depleted) = llmH.tick(true, true, i == 0);
            llmTurns = i + 1;
            if (depleted) break;
        }

        assertGt(llmTurns, scriptTurns * 2, "LLM should last >2x longer than script");
    }

    // ─── Deadline backwards compatibility ────────────────────────────────────

    function test_deadline_returns_valid_block() public {
        uint64 dl = harness.deadline(true);
        // deadline = lastTurnBlock + min(bank, MAX_TURN_TIMEOUT)
        assertGt(dl, uint64(block.number), "deadline should be in future");
        assertLe(dl, uint64(block.number + 80), "deadline should be within MAX_TURN_TIMEOUT");
    }

    function test_canTimeout_initially_false() public view {
        assertFalse(harness.canTimeout(true), "fresh clock should not be timed out");
    }

    function test_canTimeout_after_long_delay() public {
        vm.roll(block.number + 500); // way past bank
        assertTrue(harness.canTimeout(true), "should be timed out after exceeding bank");
    }

    // ─── Guaranteed termination via decay alone ────────────────────────────

    function test_decay_alone_terminates() public {
        // Even with 100% NCC success + minimum turn time,
        // the 2% decay MUST eventually drain the bank to 0.
        uint256 b = block.number;
        bool depleted = false;
        uint256 turns = 0;

        while (!depleted && turns < 200) {
            b += 5; // MIN_TURN_INTERVAL
            vm.roll(b);
            (, depleted) = harness.tick(true, true, turns == 0); // always NCC success
            turns++;
        }

        assertTrue(depleted, "Bank must deplete via decay alone");
        assertLt(turns, 200, "Should deplete well before 200 turns");
        emit log_named_uint("Turns to deplete (decay only, min interval, 100% NCC)", turns);
    }

    // ─── MAX_TURN_TIMEOUT capping ──────────────────────────────────────────

    function test_turn_capped_at_max_timeout() public {
        vm.roll(block.number + 200); // 200 blocks elapsed, but MAX_TURN_TIMEOUT = 80
        (uint128 bank,) = harness.tick(true, true, true);
        // Should deduct only 80 (capped), not 200
        // 400 - 80 = 320, then 2% decay = 6.4 → 314
        // First turn so no NCC refund
        assertGt(bank, 300, "Bank should only lose ~80 + decay, not 200");
    }
}

/**
 * @notice Harness contract to expose library functions for testing.
 */
contract ChessClockLibHarness {
    using ChessClockLib for ChessClockLib.Clock;

    ChessClockLib.Clock internal clock;

    function init() external {
        clock.init();
    }

    function tick(bool isAgentA, bool nccCorrect, bool isFirstTurn) external returns (uint128, bool) {
        return clock.tick(isAgentA, nccCorrect, isFirstTurn);
    }

    function canTimeout(bool isAgentA) external view returns (bool) {
        return clock.canTimeout(isAgentA);
    }

    function deadline(bool isAgentA) external view returns (uint64) {
        return clock.deadline(isAgentA);
    }

    function getClock() external view returns (uint128 bankA, uint128 bankB, uint64 lastTurnBlock) {
        return (clock.bankA, clock.bankB, clock.lastTurnBlock);
    }
}
