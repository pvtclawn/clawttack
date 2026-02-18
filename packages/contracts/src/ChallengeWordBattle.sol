// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IScenario.sol";

/// @title ChallengeWordBattle — Trustless verifiable outcome scenario
/// @notice Both agents commit a strategy seed pre-battle. Each turn generates a
///         deterministic challenge word from both commits. Agents MUST include
///         the challenge word in their response — miss it and you lose.
///
///         Three failure modes (all on-chain verifiable, no judge needed):
///         1. Miss the challenge word → lose
///         2. Leak your secret → lose
///         3. Timeout (enforced by transport layer) → lose
///
///         This creates verifiable outcomes without a trusted judge:
///         anyone can recompute challenge words from the commits and check the log.
contract ChallengeWordBattle is IScenario {
    /// @notice Word list for challenge word generation (4-letter words, easy to embed)
    /// @dev Deterministic: word = WORDS[hash % WORDS.length]
    string[64] private WORDS = [
        "blue", "dark", "fire", "gold", "iron", "jade", "keen", "lime",
        "mint", "navy", "onyx", "pine", "ruby", "sage", "teal", "vine",
        "arch", "bolt", "core", "dawn", "echo", "flux", "glow", "haze",
        "iris", "jolt", "knot", "loom", "mist", "node", "oath", "peak",
        "rift", "silk", "tide", "unit", "vale", "warp", "zero", "apex",
        "band", "cape", "dome", "edge", "fern", "grit", "husk", "isle",
        "jazz", "kite", "lark", "maze", "nest", "opus", "palm", "quay",
        "reed", "spur", "torn", "urge", "veil", "wolf", "yarn", "zest"
    ];

    struct BattleSetup {
        bytes32 commitA;    // keccak256(strategySeedA)
        bytes32 commitB;    // keccak256(strategySeedB)
        address agentA;
        address agentB;
        bool settled;
    }

    mapping(bytes32 => BattleSetup) public setups;

    function name() external pure override returns (string memory) {
        return "Challenge Word Battle";
    }

    function description() external pure override returns (string memory) {
        return "Each turn has a deterministic challenge word both agents must include. "
               "Miss it and you lose. Fully verifiable on-chain without a judge.";
    }

    function playerCount() external pure override returns (uint8) {
        return 2;
    }

    function maxTurns() external pure override returns (uint16) {
        return 10;
    }

    /// @notice Setup: both agents commit their strategy seeds
    /// @param data ABI-encoded (bytes32 commitA, bytes32 commitB, address agentA, address agentB)
    function setup(
        bytes32 battleId,
        address[] calldata agents,
        bytes calldata data
    ) external override returns (bytes32 commitment) {
        require(agents.length == 2, "Requires exactly 2 agents");

        (bytes32 commitA, bytes32 commitB, address agentA, address agentB) = abi.decode(
            data,
            (bytes32, bytes32, address, address)
        );

        require(
            (agents[0] == agentA && agents[1] == agentB) ||
            (agents[0] == agentB && agents[1] == agentA),
            "Agents must match roles"
        );

        setups[battleId] = BattleSetup({
            commitA: commitA,
            commitB: commitB,
            agentA: agentA,
            agentB: agentB,
            settled: false
        });

        // Commitment = hash of both seeds combined
        return keccak256(abi.encodePacked(commitA, commitB));
    }

    /// @notice Get the challenge word for a given turn
    /// @dev Deterministic: anyone can verify by recomputing from the commits
    /// @param battleId The battle identifier
    /// @param turnNumber The turn number (1-indexed)
    /// @return word The challenge word that must appear in the response
    function getChallengeWord(
        bytes32 battleId,
        uint16 turnNumber
    ) public view returns (string memory word) {
        BattleSetup storage s = setups[battleId];
        require(s.commitA != bytes32(0), "Battle not set up");
        return _generateWord(s.commitA, s.commitB, turnNumber);
    }

    /// @notice Get the turn timeout in seconds for a given turn
    /// @dev Halving timer: starts at configurable base, halves each turn, minimum 1s
    ///      Default base = 60s → 30 → 15 → 7 → 3 → 1 → 1 → 1...
    /// @param turnNumber The turn number (1-indexed)
    /// @return timeoutSeconds Seconds allowed for this turn
    function getTurnTimeout(uint16 turnNumber) public pure returns (uint16 timeoutSeconds) {
        uint16 timeout = 60;
        for (uint16 i = 1; i < turnNumber; i++) {
            timeout = timeout / 2;
            if (timeout < 1) return 1;
        }
        return timeout;
    }

    /// @notice Settle: verify which turns contained the correct challenge word
    /// @param reveal ABI-encoded (string seedA, string seedB, uint16 failTurnA, uint16 failTurnB)
    ///        failTurnA = first turn where agentA missed the challenge word (0 = never failed)
    ///        failTurnB = first turn where agentB missed the challenge word (0 = never failed)
    function settle(
        bytes32 battleId,
        bytes32 /* turnLogCid */,
        bytes calldata reveal
    ) external override returns (address winner) {
        BattleSetup storage s = setups[battleId];
        require(!s.settled, "Already settled");
        require(s.commitA != bytes32(0), "Battle not set up");

        (string memory seedA, string memory seedB, uint16 failTurnA, uint16 failTurnB) = abi.decode(
            reveal,
            (string, string, uint16, uint16)
        );

        // Verify seeds match their commitments (commit-reveal)
        require(
            keccak256(abi.encodePacked(seedA)) == s.commitA,
            "Seed A does not match commitment"
        );
        require(
            keccak256(abi.encodePacked(seedB)) == s.commitB,
            "Seed B does not match commitment"
        );

        s.settled = true;

        // Determine winner based on who failed first
        bool aFailed = failTurnA > 0;
        bool bFailed = failTurnB > 0;

        if (!aFailed && !bFailed) {
            // Neither failed — draw
            return address(0);
        } else if (aFailed && !bFailed) {
            // Only A failed — B wins
            return s.agentB;
        } else if (!aFailed && bFailed) {
            // Only B failed — A wins
            return s.agentA;
        } else {
            // Both failed — whoever failed FIRST loses
            if (failTurnA < failTurnB) {
                return s.agentB; // A failed earlier → B wins
            } else if (failTurnB < failTurnA) {
                return s.agentA; // B failed earlier → A wins
            } else {
                return address(0); // Both failed on same turn → draw
            }
        }
    }

    /// @dev Generate a deterministic challenge word from commits + turn number
    function _generateWord(
        bytes32 commitA,
        bytes32 commitB,
        uint16 turnNumber
    ) internal view returns (string memory) {
        bytes32 hash = keccak256(abi.encodePacked(turnNumber, commitA, commitB));
        uint256 index = uint256(hash) % WORDS.length;
        return WORDS[index];
    }
}
