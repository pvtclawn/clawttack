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
        uint256 totalStaked;
        uint256 totalWon;
    }

    // ─── Enums ──────────────────────────────────────────────────────────────

    enum ResultType {
        None,
        COMPROMISE,             // ECDSA signature captured
        INVALID_SOLUTION,       // VOP puzzle failed (unregistered index)
        POISON_VIOLATION,       // Narrative contained opponent's poison word
        TIMEOUT,                // Turn exceeded bank (chess clock)
        BANK_EMPTY,             // Bank depleted to 0 via penalties + decay
        NCC_REVEAL_FAILED,      // Mandatory NCC reveal not provided or invalid
        VOP_REVEAL_FAILED       // Mandatory VOP reveal not provided or invalid
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
        uint256 targetAgentId;   // 0 = open challenge, otherwise must match acceptor's agent ID
        bytes32 inviteHash;      // 0 = open, otherwise keccak256(inviteSecret) — acceptor must prove knowledge
    }

    // ─── Game Config (Tunable Protocol Parameters) ──────────────────────────

    struct GameConfig {
        uint32 initialBank;      // Starting bank for chess clock (e.g. 400)
        uint32 nccRefundBps;     // % of turn time refunded on NCC success in basis points (e.g. 5000)
        uint32 nccFailPenalty;   // blocks deducted on NCC failure (e.g. 20)
        uint32 bankDecayBps;     // % per turn in basis points (e.g. 200)
        uint32 minTurnInterval;  // minimum blocks per turn (e.g. 5)
        uint32 maxTurnTimeout;   // max blocks before timeout (e.g. 80)
        uint32 vopPenaltyBase;   // base penalty unit for VOP mistakes (e.g. 15)
        uint32 defaultEloRating; // Default Elo rating for new agents (e.g. 1500)
        uint32 maxEloDiff;       // Maximum Elo difference for rated battles (e.g. 300)
        uint32 warmupBlocks;     // blocks between acceptance and first turn (e.g. 30)
        uint8  maxJokers;        // joker (1024-byte) turns per agent (e.g. 2)
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
     * @notice Challenger commits to a VOP type index (and optional instance params) via salted hash.
     * @dev Commitment: keccak256(abi.encodePacked(battleId, turnNumber, "VOP", vopSalt, vopIndex, instanceCommit))
     *      Block number at solve time serves as universal VOP parameter.
     *      instanceCommit = keccak256(instanceParams) for param-hiding VOPs, or bytes32(0) for simple VOPs.
     */
    struct VopCommit {
        bytes32 vopCommitment;  // Salted hash of VOP index + instance
        bytes32 instanceCommit; // keccak256(vopParams) — bytes32(0) for simple VOPs
    }

    /**
     * @notice Solver's VOP claim — which VOP type they inferred from the narrative.
     * @dev Gated on NCC defense: solver must pass NCC before VOP solve is valid.
     */
    struct VopSolve {
        uint8   vopClaimedIndex;  // Which VOP type the solver thinks was committed
        bytes   solution;         // ABI-encoded solution (uint256 for simple VOPs, structured for advanced)
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
        bytes32 commitment;          // keccak256(battleId, turnNumber, "VOP", salt, index, instanceCommit)
        uint8   solverClaimedIndex;  // What the solver guessed
        bytes   solverSolution;      // ABI-encoded solution submitted by the solver
        uint64  commitBlockNumber;   // Block number at VOP commit time (used as VOP param)
        bool    solverPassed;        // Did the solver's solution verify against their claimed VOP?
        bool    hasSolverResponse;   // True after solver has responded
        bytes32 instanceCommit;      // keccak256(instanceParams) for param-hiding VOPs
    }
}
