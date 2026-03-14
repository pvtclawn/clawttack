// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackTypes} from "./ClawttackTypes.sol";

/**
 * @title ChessClockLib
 * @notice Encapsulates the v0 chess clock timing model for Clawttack battles.
 * @dev Bank-based timing replaces exponential timeout decay.
 *      Key insight: comprehension (NCC success) is rewarded with time refunds,
 *      while scripting (NCC failure) incurs penalties. Bank decay guarantees termination.
 *
 *      Simulation-verified (960K battles, 15 timing models):
 *      - LLM vs Script: 100% LLM wins
 *      - LLM vs LLM: ~50/50 (fair)
 *      - Avg game length: 38 turns, max 61
 */
library ChessClockLib {
    // ─── Configuration ──────────────────────────────────────────────────────
    uint256 constant INITIAL_BANK       = 400;   // ~13 min on Base (2s blocks)
    uint256 constant NCC_REFUND_PCT     = 50;    // % of turn time refunded on NCC success
    uint256 constant NCC_FAIL_PENALTY   = 20;    // blocks deducted on NCC failure
    uint256 constant BANK_DECAY_BPS     = 200;   // 2% per turn (basis points)
    uint256 constant MIN_TURN_INTERVAL  = 5;     // ~10s minimum per turn
    uint256 constant MAX_TURN_TIMEOUT   = 80;    // ~2.5 min max per turn
    uint256 constant BPS                = 10000;

    // ─── VOP Penalty Constants (Constant Relative Advantage) ────────────────
    //  X = VOP_PENALTY = 15 blocks (~30 seconds on Base)
    //  Matrix ensures net(C−S) = −2X for all normal outcomes → no grief incentive
    uint256 constant VOP_PENALTY                    = 15;               // X: base unit
    uint256 constant VOP_WRONG_IDX_CHALLENGER       = VOP_PENALTY * 3;  // 3X: challenger pays when index wrong
    uint256 constant VOP_WRONG_IDX_SOLVER           = VOP_PENALTY;      // X: solver pays when index wrong
    uint256 constant VOP_NCC_GATE_CHALLENGER        = VOP_PENALTY * 3;  // 3X: challenger pays when NCC gate fails
    uint256 constant VOP_NCC_GATE_SOLVER            = VOP_PENALTY;      // X: solver pays when NCC gate fails
    uint256 constant VOP_RIGHT_WRONG_SOL_SOLVER     = VOP_PENALTY * 2;  // 2X: solver pays on right idx + wrong sol
    uint256 constant VOP_RIGHT_RIGHT_CHALLENGER     = VOP_PENALTY;      // X: challenger pays on full success
    uint256 constant VOP_RIGHT_RIGHT_SOLVER_REFUND  = VOP_PENALTY;      // X: solver RECOVERS on full success

    struct Clock {
        uint128 bankA;          // remaining blocks for agent A
        uint128 bankB;          // remaining blocks for agent B
        uint64  lastTurnBlock;  // block.number of last submission
    }

    // ─── Events ─────────────────────────────────────────────────────────────
    event BankUpdated(uint256 indexed battleId, bool isAgentA, uint128 newBank, int256 delta);

    // ─── Errors ─────────────────────────────────────────────────────────────
    error TurnTooFast();        // block.number - lastTurnBlock < MIN_TURN_INTERVAL
    error BankEmpty();          // agent's bank reached 0

    /**
     * @notice Initializes both clocks at battle acceptance.
     */
    function init(Clock storage self) internal {
        self.bankA = uint128(INITIAL_BANK);
        self.bankB = uint128(INITIAL_BANK);
        self.lastTurnBlock = uint64(block.number);
    }

    /**
     * @notice Processes a turn's timing: deducts time, applies decay, handles NCC result.
     * @param self The clock storage.
     * @param isAgentA True if the current mover is agent A.
     * @param nccCorrect True if the agent passed the NCC challenge.
     * @param isFirstTurn True if this is turn 0 (no NCC to resolve).
     * @return bankAfter The agent's bank after all operations.
     * @return bankDepleted True if agent's bank hit zero (caller should settle as loss).
     */
    function tick(
        Clock storage self,
        bool isAgentA,
        bool nccCorrect,
        bool isFirstTurn
    ) internal returns (uint128 bankAfter, bool bankDepleted) {
        return _tick(self, isAgentA, nccCorrect, isFirstTurn);
    }


    function _tick(
        Clock storage self,
        bool isAgentA,
        bool nccCorrect,
        bool isFirstTurn
    ) private returns (uint128 bankAfter, bool bankDepleted) {
        uint256 elapsed = block.number - self.lastTurnBlock;
        if (elapsed < MIN_TURN_INTERVAL) revert TurnTooFast();

        // Turn time = actual elapsed blocks (no cap — idle = drain)
        uint256 turnTime = elapsed;

        uint256 bank = isAgentA ? self.bankA : self.bankB;

        // 1. Deduct turn time
        if (turnTime >= bank) {
            _setBank(self, isAgentA, 0);
            self.lastTurnBlock = uint64(block.number);
            return (0, true);
        }
        bank -= turnTime;

        // 2. Apply bank decay (guaranteed termination)
        uint256 decay = bank * BANK_DECAY_BPS / BPS;
        if (decay == 0) decay = 1; // minimum 1 block decay
        bank = bank > decay ? bank - decay : 0;
        if (bank == 0) {
            _setBank(self, isAgentA, 0);
            self.lastTurnBlock = uint64(block.number);
            return (0, true);
        }

        // 3. NCC consequence (skip on first turn — no prior challenge)
        if (!isFirstTurn) {
            if (nccCorrect) {
                // Refund turn time
                uint256 refund = turnTime * NCC_REFUND_PCT / 100;
                bank += refund;
                // Cap at initial bank (prevent infinite accumulation — invariant CC1)
                if (bank > INITIAL_BANK) bank = INITIAL_BANK;
            } else {
                // Penalty
                bank = bank > NCC_FAIL_PENALTY ? bank - NCC_FAIL_PENALTY : 0;
                if (bank == 0) {
                    _setBank(self, isAgentA, 0);
                    self.lastTurnBlock = uint64(block.number);
                    return (0, true);
                }
            }
        }



        // 5. Store
        bankAfter = uint128(bank);
        _setBank(self, isAgentA, bankAfter);
        self.lastTurnBlock = uint64(block.number);
        return (bankAfter, false);
    }

    /**
     * @notice Applies VOP result penalties/rewards to both players' banks.
     * @dev Implements the Constant Relative Advantage matrix:
     *      NccGateFailed:       challenger −3X, solver −X  (net −2X)
     *      WrongIndex:          challenger −3X, solver −X  (net −2X)
     *      RightIndexWrongSol:  challenger  0,  solver −2X (net +2X, rare)
     *      RightIndexRightSol:  challenger −X,  solver +X  (net −2X)
     * @param self The clock storage.
     * @param isChallengerA True if agent A was the challenger for this VOP round.
     * @param outcome The VOP outcome enum.
     * @return challengerDepleted True if challenger's bank hit zero.
     * @return solverDepleted True if solver's bank hit zero.
     */
    function applyVopResult(
        Clock storage self,
        bool isChallengerA,
        ClawttackTypes.VopOutcome outcome
    ) internal returns (bool challengerDepleted, bool solverDepleted) {
        uint256 challengerBank = isChallengerA ? self.bankA : self.bankB;
        uint256 solverBank = isChallengerA ? self.bankB : self.bankA;

        if (outcome == ClawttackTypes.VopOutcome.NccGateFailed) {
            // Challenger −3X, Solver −X
            challengerBank = challengerBank > VOP_NCC_GATE_CHALLENGER
                ? challengerBank - VOP_NCC_GATE_CHALLENGER : 0;
            solverBank = solverBank > VOP_NCC_GATE_SOLVER
                ? solverBank - VOP_NCC_GATE_SOLVER : 0;

        } else if (outcome == ClawttackTypes.VopOutcome.WrongIndex) {
            // Challenger −3X, Solver −X
            challengerBank = challengerBank > VOP_WRONG_IDX_CHALLENGER
                ? challengerBank - VOP_WRONG_IDX_CHALLENGER : 0;
            solverBank = solverBank > VOP_WRONG_IDX_SOLVER
                ? solverBank - VOP_WRONG_IDX_SOLVER : 0;

        } else if (outcome == ClawttackTypes.VopOutcome.RightIndexWrongSol) {
            // Challenger 0, Solver −2X
            solverBank = solverBank > VOP_RIGHT_WRONG_SOL_SOLVER
                ? solverBank - VOP_RIGHT_WRONG_SOL_SOLVER : 0;

        } else if (outcome == ClawttackTypes.VopOutcome.RightIndexRightSol) {
            // Challenger −X, Solver +X
            challengerBank = challengerBank > VOP_RIGHT_RIGHT_CHALLENGER
                ? challengerBank - VOP_RIGHT_RIGHT_CHALLENGER : 0;
            solverBank += VOP_RIGHT_RIGHT_SOLVER_REFUND;
            // Cap at initial bank (prevent infinite accumulation)
            if (solverBank > INITIAL_BANK) solverBank = INITIAL_BANK;
        }

        // Write back
        _setBank(self, isChallengerA, uint128(challengerBank));
        _setBank(self, !isChallengerA, uint128(solverBank));

        return (challengerBank == 0, solverBank == 0);
    }

    /**
     * @notice Check if an agent can be timed out (bank effectively 0 or turn exceeded max).
     */
    function canTimeout(Clock storage self, bool isAgentA) internal view returns (bool) {
        uint256 elapsed = block.number - self.lastTurnBlock;
        uint256 bank = isAgentA ? self.bankA : self.bankB;
        return elapsed > bank || elapsed > MAX_TURN_TIMEOUT;
    }

    /**
     * @notice Returns the effective deadline block for the current player.
     * @dev Used for backwards compatibility with v3 timeout claiming.
     */
    function deadline(Clock storage self, bool isAgentA) internal view returns (uint64) {
        uint256 bank = isAgentA ? self.bankA : self.bankB;
        uint256 maxTime = bank < MAX_TURN_TIMEOUT ? bank : MAX_TURN_TIMEOUT;
        return uint64(self.lastTurnBlock + maxTime);
    }

    function _setBank(Clock storage self, bool isAgentA, uint128 value) private {
        if (isAgentA) self.bankA = value;
        else self.bankB = value;
    }
}
