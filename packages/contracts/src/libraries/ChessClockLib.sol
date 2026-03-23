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
    uint256 constant BPS                = 10000;

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
    function init(Clock storage self, ClawttackTypes.GameConfig memory config) internal {
        self.bankA = uint128(config.initialBank);
        self.bankB = uint128(config.initialBank);
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
        bool isFirstTurn,
        ClawttackTypes.GameConfig memory config
    ) internal returns (uint128 bankAfter, bool bankDepleted) {
        return _tick(self, isAgentA, nccCorrect, isFirstTurn, config);
    }


    function _tick(
        Clock storage self,
        bool isAgentA,
        bool nccCorrect,
        bool isFirstTurn,
        ClawttackTypes.GameConfig memory config
    ) private returns (uint128 bankAfter, bool bankDepleted) {
        uint256 elapsed = block.number - self.lastTurnBlock;
        if (elapsed < config.minTurnInterval) revert TurnTooFast();

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
        uint256 decay = bank * config.bankDecayBps / BPS;
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
                uint256 refund = turnTime * config.nccRefundBps / BPS;
                bank += refund;
                // Cap at initial bank (prevent infinite accumulation — invariant CC1)
                if (bank > config.initialBank) bank = config.initialBank;
            } else {
                // Penalty
                bank = bank > config.nccFailPenalty ? bank - config.nccFailPenalty : 0;
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
        ClawttackTypes.VopOutcome outcome,
        ClawttackTypes.GameConfig memory config
    ) internal returns (bool challengerDepleted, bool solverDepleted) {
        uint256 challengerBank = isChallengerA ? self.bankA : self.bankB;
        uint256 solverBank = isChallengerA ? self.bankB : self.bankA;
        
        uint256 penalty = config.vopPenaltyBase;

        if (outcome == ClawttackTypes.VopOutcome.NccGateFailed) {
            // Challenger −3X, Solver −X
            challengerBank = challengerBank > penalty * 3
                ? challengerBank - penalty * 3 : 0;
            solverBank = solverBank > penalty
                ? solverBank - penalty : 0;

        } else if (outcome == ClawttackTypes.VopOutcome.WrongIndex) {
            // Challenger −3X, Solver −X
            challengerBank = challengerBank > penalty * 3
                ? challengerBank - penalty * 3 : 0;
            solverBank = solverBank > penalty
                ? solverBank - penalty : 0;

        } else if (outcome == ClawttackTypes.VopOutcome.RightIndexWrongSol) {
            // Challenger 0, Solver −2X
            solverBank = solverBank > penalty * 2
                ? solverBank - penalty * 2 : 0;

        } else if (outcome == ClawttackTypes.VopOutcome.RightIndexRightSol) {
            // Challenger −X, Solver +X
            challengerBank = challengerBank > penalty
                ? challengerBank - penalty : 0;
            solverBank += penalty; // refund solver
            // Cap at initial bank (prevent infinite accumulation)
            if (solverBank > config.initialBank) solverBank = config.initialBank;
        }

        // Write back
        _setBank(self, isChallengerA, uint128(challengerBank));
        _setBank(self, !isChallengerA, uint128(solverBank));

        return (challengerBank == 0, solverBank == 0);
    }

    /**
     * @notice Check if an agent can be timed out (bank effectively 0 or turn exceeded max).
     */
    function canTimeout(Clock storage self, bool isAgentA, ClawttackTypes.GameConfig memory config) internal view returns (bool) {
        uint256 elapsed = block.number - self.lastTurnBlock;
        uint256 bank = isAgentA ? self.bankA : self.bankB;
        return elapsed > bank || elapsed > config.maxTurnTimeout;
    }

    /**
     * @notice Returns the effective deadline block for the current player.
     * @dev Used for backwards compatibility with v3 timeout claiming.
     */
    function deadline(Clock storage self, bool isAgentA, ClawttackTypes.GameConfig memory config) internal view returns (uint64) {
        uint256 bank = isAgentA ? self.bankA : self.bankB;
        uint256 maxTime = bank < config.maxTurnTimeout ? bank : config.maxTurnTimeout;
        return uint64(self.lastTurnBlock + maxTime);
    }

    function _setBank(Clock storage self, bool isAgentA, uint128 value) private {
        if (isAgentA) self.bankA = value;
        else self.bankB = value;
    }
}
