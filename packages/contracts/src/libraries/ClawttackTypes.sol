// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackTypes
 * @notice All data structures for Clawttack (chess clock + VCPSC NCC + VOP commit-reveal).
 *
 * Key design decisions:
 * - BattleConfig: removed baseTimeoutBlocks/maxTurns (replaced by chess clock)
 * - TurnPayload: NCC + VOP commit-reveal in single payload
 * - NCC gates VOP: fail NCC → auto-wrong VOP (no solution verified)
 * - Constant Relative Advantage matrix: challenger −3X / solver −X on all failure paths
 * - Block number as universal VOP param (no pre-generated puzzle boards)
 * - Domain-separated commitments (battleId + turnNumber bound)
 */
library ClawttackTypes {

    // ─── Agent Profile ──────────────────────────────────────────────────────

    struct AgentProfile {
        address owner;
        uint32  eloRating;
        uint32  totalWins;
        uint32  totalLosses;
    }

    // ─── Enums ──────────────────────────────────────────────────────────────

    enum ResultType {
        None,
        COMPROMISE,         // ECDSA signature captured
        INVALID_SOLUTION,   // VOP puzzle failed (unregistered index)
        POISON_VIOLATION,   // Narrative contained opponent's poison word
        TIMEOUT,            // Turn exceeded bank (chess clock)
        BANK_EMPTY,         // Bank depleted to 0 via penalties + decay
        NCC_REVEAL_FAILED,  // Mandatory NCC reveal not provided or invalid
        VOP_REVEAL_FAILED   // Mandatory VOP reveal not provided or invalid
    }

    // ─── VOP Outcome (used by ChessClockLib for penalty application) ────────

    enum VopOutcome {
        NccGateFailed,          // NCC defense failed → auto-wrong VOP
        WrongIndex,             // Solver guessed wrong VOP index
        RightIndexWrongSol,     // Right index but invalid solution
        RightIndexRightSol      // Right index + valid solution
    }

    // ─── Battle Config ──────────────────────────────────────────────────────

    struct BattleConfig {
        uint256 stake;           // ETH stake per side
        uint32  warmupBlocks;    // blocks before first turn allowed
        uint256 targetAgentId;   // 0 = open challenge
        uint8   maxJokers;       // joker (1024-byte) turns per agent
        // Chess clock params are constants in ChessClockLib
        // No maxTurns — bank decay guarantees termination
    }

    // ─── NCC Attack (submitted by attacker each turn) ───────────────────────

    /**
     * @notice The attacker's NCC challenge for the defender's next turn.
     * @dev 4 BIP39 candidates embedded in the narrative at verified offsets.
     *      Commitment: keccak256(abi.encodePacked(battleId, turnNumber, "NCC", salt, intendedIdx))
     */
    struct NccAttack {
        uint16[4] candidateWordIndices;
        uint16[4] candidateOffsets;
        bytes32   nccCommitment;
    }

    struct NccDefense {
        uint8 guessIdx;  // 0-3
    }

    struct NccReveal {
        bytes32 salt;
        uint8   intendedIdx; // 0-3
    }

    // ─── VOP Commit-Reveal ──────────────────────────────────────────────────

    /**
     * @notice Challenger commits to a VOP type index via salted hash.
     * @dev Commitment: keccak256(abi.encodePacked(battleId, turnNumber, "VOP", vopSalt, vopIndex))
     *      Block number at solve time serves as universal VOP parameter.
     */
    struct VopCommit {
        bytes32 vopCommitment;  // Salted hash of VOP index
    }

    /**
     * @notice Solver's VOP claim — which VOP type they inferred from the narrative.
     * @dev Gated on NCC defense: solver must pass NCC before VOP solve is valid.
     */
    struct VopSolve {
        uint8   vopClaimedIndex;  // Which VOP type the solver thinks was committed
        uint256 solution;         // Solution to that VOP (using commit block number as param)
    }

    /**
     * @notice Challenger reveals their VOP commitment on their next turn.
     * @dev Must match stored commitment. Mismatch = instant forfeit.
     */
    struct VopReveal {
        bytes32 vopSalt;
        uint8   vopIndex;  // Which VOP type was actually committed
    }

    // ─── Turn Payload ───────────────────────────────────────────────────────

    /**
     * @notice Everything an agent submits per turn.
     * @dev Bundles narrative, NCC attack/defense/reveal, VOP commit/solve/reveal.
     */
    struct TurnPayload {
        // --- Core ---
        string  narrative;
        string  customPoisonWord;

        // --- NCC ---
        NccAttack  nccAttack;
        NccDefense nccDefense;   // Only meaningful after turn 0
        NccReveal  nccReveal;    // Only meaningful after turn 1

        // --- VOP ---
        VopCommit  vopCommit;    // Challenger commits VOP type for opponent
        VopSolve   vopSolve;     // Solver's claimed VOP index + solution
        VopReveal  vopReveal;    // Reveal previous VOP commitment (turn >= 2)
    }

    // ─── Pending NCC State ──────────────────────────────────────────────────

    struct PendingNcc {
        bytes32   commitment;
        uint16[4] candidateWordIndices;
        uint8     defenderGuessIdx;
        bool      hasDefenderGuess;
    }

    // ─── Pending VOP State ──────────────────────────────────────────────────

    /**
     * @notice Stored VOP state awaiting reveal on the next turn.
     */
    struct PendingVop {
        bytes32 commitment;          // keccak256(battleId, turnNumber, "VOP", salt, index)
        uint8   solverClaimedIndex;  // What the solver guessed
        uint256 solverSolution;      // What the solver submitted
        uint64  commitBlockNumber;   // Block number at VOP commit time (used as VOP param)
        bool    solverPassed;        // Did the solver's solution verify against their claimed VOP?
        bool    hasSolverResponse;   // True after solver has responded
    }
}
