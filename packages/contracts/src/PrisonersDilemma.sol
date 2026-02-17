// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IScenario.sol";

/// @title PrisonersDilemma — Classic game theory scenario
/// @notice Both agents simultaneously choose to COOPERATE or DEFECT.
///         Choices are commit-revealed on-chain for trustless verification.
///
///         Payoff matrix (standard):
///           Both cooperate: 3/3  (mutual cooperation)
///           A defects, B cooperates: 5/1  (temptation/sucker)
///           Both defect: 1/1  (mutual defection)
///
///         The agent with more points wins.
///         Equal points = draw.
contract PrisonersDilemma is IScenario {
    // --- State ---

    struct BattleSetup {
        address agentA;       // First registered agent
        address agentB;       // Second registered agent
        bytes32 commitA;      // keccak256(choice || salt)
        bytes32 commitB;
        bool settled;
    }

    mapping(bytes32 => BattleSetup) public setups;

    // --- IScenario Implementation ---

    function name() external pure override returns (string memory) {
        return "Prisoner's Dilemma";
    }

    function description() external pure override returns (string memory) {
        return "Classic game theory. Both agents simultaneously choose COOPERATE or DEFECT. Choices are commit-revealed on-chain.";
    }

    function playerCount() external pure override returns (uint8) {
        return 2;
    }

    function maxTurns() external pure override returns (uint16) {
        return 2; // Each agent submits one "turn" (their commitment)
    }

    /// @notice Setup: register the two agents
    /// @param data ABI-encoded (bytes32 commitA, bytes32 commitB)
    ///        Commits are submitted before battle — each agent hashes their choice + salt
    function setup(
        bytes32 battleId,
        address[] calldata agents,
        bytes calldata data
    ) external override returns (bytes32 commitment) {
        require(agents.length == 2, "Requires exactly 2 agents");

        (bytes32 commitA, bytes32 commitB) = abi.decode(data, (bytes32, bytes32));

        setups[battleId] = BattleSetup({
            agentA: agents[0],
            agentB: agents[1],
            commitA: commitA,
            commitB: commitB,
            settled: false
        });

        // Combined commitment — proves both choices were locked
        return keccak256(abi.encodePacked(commitA, commitB));
    }

    /// @notice Settle: reveal both choices and determine winner
    /// @param reveal ABI-encoded (bool choiceA, bytes32 saltA, bool choiceB, bytes32 saltB)
    ///        choice = true means COOPERATE, false means DEFECT
    function settle(
        bytes32 battleId,
        bytes32 /* turnLogCid */,
        bytes calldata reveal
    ) external override returns (address winner) {
        BattleSetup storage s = setups[battleId];
        require(!s.settled, "Already settled");
        require(s.agentA != address(0), "Battle not set up");

        (bool choiceA, bytes32 saltA, bool choiceB, bytes32 saltB) = abi.decode(
            reveal,
            (bool, bytes32, bool, bytes32)
        );

        // Verify commitments
        require(
            keccak256(abi.encodePacked(choiceA, saltA)) == s.commitA,
            "Agent A commitment mismatch"
        );
        require(
            keccak256(abi.encodePacked(choiceB, saltB)) == s.commitB,
            "Agent B commitment mismatch"
        );

        s.settled = true;

        // Calculate payoffs
        uint256 payoffA;
        uint256 payoffB;

        if (choiceA && choiceB) {
            // Both cooperate
            payoffA = 3;
            payoffB = 3;
        } else if (choiceA && !choiceB) {
            // A cooperates, B defects
            payoffA = 0;
            payoffB = 5;
        } else if (!choiceA && choiceB) {
            // A defects, B cooperates
            payoffA = 5;
            payoffB = 0;
        } else {
            // Both defect
            payoffA = 1;
            payoffB = 1;
        }

        if (payoffA > payoffB) {
            return s.agentA;
        } else if (payoffB > payoffA) {
            return s.agentB;
        } else {
            return address(0); // Draw
        }
    }
}
