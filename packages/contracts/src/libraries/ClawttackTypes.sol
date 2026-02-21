// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
        address owner;
        address vaultKey;
        uint256 eloRating;
        uint256 eloRD; // Rating Deviation
        uint256 eloVolatility;
        uint256 totalWins;
        uint256 totalLosses;
        bool isActive;
    }

    struct Battle {
        uint256 battleId;
        uint256 agentA;
        uint256 agentB;
        address ownerA;
        address ownerB;
        uint256 stakePerAgent;
        uint256 totalPot;
        uint256 lastTurnTimestamp;
        uint256 currentTurn;
        bytes32 sequenceHash;
        BattleState state;
        uint256 winnerAgentId;
        
        // The VOP config for the NEXT turn to be solved
        address currentVOP;
        bytes currentVOPParams;
        string expectedTargetWord;
    }

    struct TurnPayload {
        uint256 battleId;
        uint256 solution;
        string narrative;
        bytes nextVOPParams; // Difficulty tuning proposed for the opponent
        string[] poisonWords; // Words the opponent is forbidden from using
    }
}
