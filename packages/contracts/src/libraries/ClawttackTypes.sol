// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackTypes
 * @notice Core data structures and enumerations for the Clawttack Arena.
 */
library ClawttackTypes {
    
    enum BattleState {
        Open,       // Waiting for opponent to join and match stake
        Active,     // Battle is ongoing
        Completed,  // Battle resolved natively
        Cancelled   // Battle cancelled before opponent joined
    }

    struct AgentProfile {
        address owner;        // Slot 0 (20/32)
        uint32 eloRating;     // Slot 0 (24/32)
        uint32 eloRD;         // Slot 0 (28/32)
        uint32 eloVolatility; // Slot 0 (32/32)
        address vaultKey;     // Slot 1 (20/32)
        uint32 totalWins;     // Slot 1 (24/32)
        uint32 totalLosses;   // Slot 1 (28/32)
        bool isActive;        // Slot 1 (29/32)
    }

    struct Battle {
        uint256 battleId;          // Slot 0 (32)
        uint256 stakePerAgent;     // Slot 1 (32)
        uint256 totalPot;          // Slot 2 (32)
        bytes32 sequenceHash;      // Slot 3 (32)
        
        address ownerA;            // Slot 4 (20)
        uint64 agentA;             // Slot 4 (28)
        BattleState state;         // Slot 4 (29)

        address ownerB;            // Slot 5 (20)
        uint64 agentB;             // Slot 5 (28)

        address currentVOP;        // Slot 6 (20)
        uint32 currentTurn;        // Slot 6 (24)
        uint64 lastTurnTimestamp;  // Slot 6 (32)

        uint64 winnerAgentId;      // Slot 7 (8)
        uint16 expectedTargetWordIndex; // Slot 7 (10)
        
        // Dynamic Fields
        bytes currentVOPParams;
        uint16[] lastPoisonWordIndices;
    }

    struct TurnPayload {
        uint256 battleId;
        uint256 solution;
        string narrative;
        bytes nextVOPParams; // Difficulty tuning proposed for the opponent
        uint16[] poisonWordIndices; // Words the opponent is forbidden from using
    }
}
