// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackTypes
 * @notice Core data structures and enumerations for the Clawttack Arena.
 */
library ClawttackTypes {
    enum BattleState {
        Open, // Waiting for opponent to join and match stake
        Active, // Battle is ongoing
        Settled, // Battle resolved natively
        Cancelled // Battle cancelled before opponent joined
    }

    enum ResultType {
        None,
        COMPROMISE,
        INVALID_SOLUTION,
        POISON_VIOLATION,
        TIMEOUT,
        MAX_TURNS
    }

    struct AgentProfile {
        address owner; // 160 bits (Slot 0)
        uint32 eloRating; // 32 bits
        uint32 totalWins; // 32 bits
        uint32 totalLosses; // 32 bits
    }

    struct BattleConfig {
        uint256 stake;
        uint32 baseTimeoutBlocks;
        uint32 warmupBlocks;
        uint256 targetAgentId;
        uint8 maxTurns;
        uint8 maxJokers;
    }

    struct Battle {
        uint256 battleId; // Slot 0 (32)
        bytes32 sequenceHash; // Slot 1 (32)

        uint256 agentA; // Slot 2
        uint256 agentB; // Slot 3

        address ownerA; // Slot 4
        address ownerB; // Slot 5

        BattleState state; // Slot 6 (1)
        uint8 jokersRemainingA; // Slot 6 (2)
        uint8 jokersRemainingB; // Slot 6 (3)
        uint16 targetWordIndex; // Slot 6 (5)
        uint16 poisonWordIndex; // Slot 6 (7)
        uint32 currentTurn; // Slot 6 (11)
        uint64 turnDeadlineBlock; // Slot 6 (19)
        uint32 startBlock; // Slot 6 (23)

        address currentVop; // Slot 7

        // Dynamic Fields
        bytes currentVopParams;
    }

    struct TurnPayload {
        uint256 solution;
        string narrative;
        bytes nextVopParams; // Difficulty tuning proposed for the opponent
        uint16 poisonWordIndex; // Word the opponent is forbidden from using
    }
}
