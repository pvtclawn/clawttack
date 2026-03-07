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

    function test_init_sets_banks() public {
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

    function test_canTimeout_initially_false() public {
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

    // ─── Fuzz Tests ─────────────────────────────────────────────────────────

    /// @notice Bank NEVER goes negative (underflow) regardless of elapsed time or NCC result
    function testFuzz_bankNeverUnderflows(uint8 elapsed, bool nccCorrect) public {
        // Bound elapsed to valid range (MIN_TURN_INTERVAL to MAX_TURN_TIMEOUT * 2)
        uint256 e = bound(uint256(elapsed), 5, 160);
        vm.roll(block.number + e);

        (uint128 bank, bool depleted) = harness.tick(true, nccCorrect, true);

        if (depleted) {
            assertEq(bank, 0, "Depleted bank must be 0");
        } else {
            assertGt(bank, 0, "Non-depleted bank must be positive");
            assertLe(bank, 400, "Bank must never exceed initial");
        }
    }

    /// @notice Bank is monotonically non-increasing when NCC always fails
    function testFuzz_failingNcc_alwaysDrains(uint8 numTurns) public {
        uint256 turns = bound(uint256(numTurns), 1, 50);
        uint256 b = block.number;
        uint128 prevBank = 400;

        for (uint256 i = 0; i < turns; i++) {
            b += 10; // 10 blocks per turn
            vm.roll(b);

            (uint128 bank, bool depleted) = harness.tick(true, false, i == 0);

            if (depleted) {
                assertEq(bank, 0);
                return; // game over
            }
            assertLe(bank, prevBank, "Bank must decrease on NCC fail");
            prevBank = bank;
        }
    }

    /// @notice NCC success refund never exceeds INITIAL_BANK (cap invariant CC1)
    function testFuzz_refundCapped(uint8 elapsed) public {
        uint256 e = bound(uint256(elapsed), 5, 80);

        // First turn: establish baseline
        vm.roll(block.number + 5);
        harness.tick(true, true, true);

        // Second turn with NCC success
        vm.roll(block.number + e);
        (uint128 bank,) = harness.tick(true, true, false);

        assertLe(bank, 400, "Refund must never push bank above INITIAL_BANK");
    }

    // ─── Brier Scoring Tests ────────────────────────────────────────────────

    /// @notice Brier penalty drains OPPONENT's bank when their solve rate is below threshold
    function test_cloze_dual_penalty_drains_attacker() public {
        // Turn 0 (A, first turn)
        vm.roll(100);
        harness.tick(true, true, true);

        // Turn 1 (B)
        vm.roll(120);
        harness.tick(false, true, false);

        // Snapshot B's bank before cloze dual-penalty tick
        (,uint128 bankBBefore,) = harness.getClock();

        // A fails NCC (nccCorrect=false) with cloze enabled → attacker (B) also eats penalty
        vm.roll(140);
        harness.tickWithCloze(true, false, false, true);

        (,uint128 bankBAfter,) = harness.getClock();
        assertLt(bankBAfter, bankBBefore, "Cloze dual penalty should drain attacker bank when defender fails");
    }

    /// @notice Cloze dual-penalty does NOT apply when defender succeeds
    function test_cloze_no_attacker_penalty_on_success() public {
        vm.roll(100);
        harness.tick(true, true, true);

        vm.roll(120);
        harness.tick(false, true, false);

        (,uint128 bankBBefore,) = harness.getClock();

        // A succeeds NCC (nccCorrect=true) with cloze enabled → no attacker penalty
        vm.roll(140);
        harness.tickWithCloze(true, true, false, true);

        (,uint128 bankBAfter,) = harness.getClock();
        assertEq(bankBAfter, bankBBefore, "No attacker penalty when defender succeeds");
    }

    /// @notice Cloze dual-penalty does NOT apply when clozeEnabled=false (backward compat)
    function test_cloze_disabled_no_attacker_penalty() public {
        vm.roll(100);
        harness.tick(true, true, true);

        vm.roll(120);
        harness.tick(false, true, false);

        (,uint128 bankBBefore,) = harness.getClock();

        // A fails NCC but cloze disabled → no attacker penalty
        vm.roll(140);
        harness.tickWithCloze(true, false, false, false);

        (,uint128 bankBAfter,) = harness.getClock();
        assertEq(bankBAfter, bankBBefore, "No attacker penalty when cloze disabled");
    }

    /// @notice Cloze dual-penalty does NOT apply on first turn
    function test_cloze_no_penalty_first_turn() public {
        vm.roll(100);
        harness.tick(true, true, true);

        vm.roll(120);
        harness.tick(false, true, false);

        (,uint128 bankBBefore,) = harness.getClock();

        // First turn with cloze enabled → no penalty (no prior NCC to fail)
        vm.roll(140);
        harness.tickWithCloze(true, false, true, true);

        (,uint128 bankBAfter,) = harness.getClock();
        assertEq(bankBAfter, bankBBefore, "No attacker penalty on first turn");
    }

    /// @notice Cloze dual-penalty floors opponent bank at zero (no underflow)
    function test_cloze_penalty_floors_at_zero() public {
        vm.roll(100);
        harness.tick(true, true, true);

        // Drain B's bank to near zero via many failed NCC ticks
        uint256 bn = 120;
        for (uint256 i = 0; i < 50; i++) {
            bn += 10;
            vm.roll(bn);
            (uint128 bank, bool depleted) = harness.tick(false, false, false);
            if (depleted) break;
            if (bank <= 10) break;
        }

        (,uint128 bankBLow,) = harness.getClock();
        if (bankBLow > 0 && bankBLow <= 10) {
            bn += 10;
            vm.roll(bn);
            harness.tickWithCloze(true, false, false, true);

            (,uint128 bankBFinal,) = harness.getClock();
            assertEq(bankBFinal, 0, "Bank should floor at 0, not underflow");
        }
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

    function tickWithCloze(
        bool isAgentA,
        bool nccCorrect,
        bool isFirstTurn,
        bool clozeEnabled
    ) external returns (uint128, bool) {
        return clock.tickWithCloze(isAgentA, nccCorrect, isFirstTurn, clozeEnabled);
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
