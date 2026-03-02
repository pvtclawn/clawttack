// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackTypesV4
 * @notice Extended data structures for Clawttack v4 (chess clock + VCPSC NCC).
 * @dev Additive to ClawttackTypes — v3 types remain for backwards compatibility.
 *
 * Key changes from v3:
 * - BattleConfig: removed baseTimeoutBlocks/maxTurns (replaced by chess clock)
 * - TurnPayload: replaces challengeHash/responseHash with VCPSC fields
 * - New: NccAttack struct (4 candidates + commitment)
 * - New: NccDefense struct (guess index)
 * - New: ResultType.BANK_EMPTY
 */
library ClawttackTypesV4 {

    // ─── Enums ──────────────────────────────────────────────────────────────

    enum ResultType {
        None,
        COMPROMISE,         // ECDSA signature captured
        INVALID_SOLUTION,   // VOP puzzle failed
        POISON_VIOLATION,   // Narrative contained opponent's poison word
        TIMEOUT,            // Turn exceeded bank (chess clock)
        BANK_EMPTY,         // Bank depleted to 0 via NCC penalties + decay
        FLAG_CAPTURED,      // CTF secret revealed
        NCC_REVEAL_FAILED   // Mandatory NCC reveal not provided or invalid
    }

    // ─── Battle Config (v4) ─────────────────────────────────────────────────

    struct BattleConfigV4 {
        uint256 stake;           // ETH stake per side
        uint32  warmupBlocks;    // blocks before first turn allowed
        uint256 targetAgentId;   // 0 = open challenge
        uint8   maxJokers;       // joker (1024-byte) turns per agent
        bool    clozeEnabled;    // require [BLANK] in narratives for NCC comprehension
        // Chess clock params are constants in ChessClockLib
        // No maxTurns — bank decay guarantees termination
    }

    // ─── NCC Attack (submitted by attacker each turn) ───────────────────────

    /**
     * @notice The attacker's NCC challenge for the defender's next turn.
     * @dev 4 BIP39 candidates embedded in the narrative at verified offsets.
     *      Attacker commits to which one is the "intended answer" via salted hash.
     *
     * Commitment: keccak256(abi.encodePacked(salt, intendedIdx))
     * Reveal: on next turn, attacker provides salt + intendedIdx
     *
     * Contract verifies all 4 candidates exist at claimed offsets during submission.
     */
    struct NccAttack {
        // 4 BIP39 word indices (from WordDictionary)
        uint16[4] candidateWordIndices;
        // Byte offsets where each candidate appears in the narrative
        uint16[4] candidateOffsets;
        // Salted commitment to intended answer: keccak256(salt, intendedIdx)
        bytes32   nccCommitment;
    }

    // ─── NCC Defense (submitted by defender each turn) ──────────────────────

    /**
     * @notice The defender's NCC response to the attacker's previous challenge.
     * @dev Defender picks one of 4 candidates as their answer.
     */
    struct NccDefense {
        uint8 guessIdx;  // 0-3: which candidate the defender thinks is correct
    }

    // ─── NCC Reveal (submitted by attacker on their next turn) ──────────────

    /**
     * @notice The attacker reveals their intended answer from the previous turn's NCC.
     * @dev Must match the commitment. Failure to reveal = forfeit.
     */
    struct NccReveal {
        bytes32 salt;       // Salt used in commitment
        uint8   intendedIdx; // 0-3: which candidate was the intended answer
    }

    // ─── Turn Payload (v4) ──────────────────────────────────────────────────

    /**
     * @notice Everything an agent submits per turn.
     * @dev Combines narrative, VOP solution, NCC attack, NCC defense, and NCC reveal.
     */
    struct TurnPayloadV4 {
        // --- Core ---
        string  narrative;          // The narrative text (max 256 or 1024 bytes)
        uint256 solution;           // VOP puzzle solution
        string  customPoisonWord;   // Poison word for opponent's next turn

        // --- NCC Attack (for opponent's next turn) ---
        NccAttack nccAttack;

        // --- NCC Defense (answer to opponent's previous NCC) ---
        NccDefense nccDefense;      // Only meaningful after turn 0

        // --- NCC Reveal (reveal YOUR previous NCC commitment) ---
        NccReveal nccReveal;        // Only meaningful after turn 1
    }

    // ─── Pending NCC State (stored between turns) ───────────────────────────

    /**
     * @notice Stored NCC state awaiting resolution on the next turn.
     */
    struct PendingNcc {
        bytes32   commitment;           // keccak256(salt, intendedIdx)
        uint16[4] candidateWordIndices; // The 4 BIP39 word indices
        uint8     defenderGuessIdx;     // Defender's guess (set when defender responds)
        bool      hasDefenderGuess;     // True after defender has responded
    }
}
