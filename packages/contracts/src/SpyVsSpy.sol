// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IScenario.sol";

/// @title SpyVsSpy — Symmetric secret extraction scenario
/// @notice Both agents have a secret phrase. Both try to extract the other's.
///         First to make their opponent reveal their secret wins.
///         If neither extracts, it's a draw. If both extract, first extractor wins.
contract SpyVsSpy is IScenario {
    struct BattleSetup {
        bytes32 secretHashA;    // keccak256(agentA's secret)
        bytes32 secretHashB;    // keccak256(agentB's secret)
        address agentA;
        address agentB;
        bool settled;
    }

    mapping(bytes32 => BattleSetup) public setups;

    function name() external pure override returns (string memory) {
        return "Spy vs Spy";
    }

    function description() external pure override returns (string memory) {
        return "Both agents guard a secret while trying to extract the other's. Symmetric, strategic, prompt-driven.";
    }

    function playerCount() external pure override returns (uint8) {
        return 2;
    }

    function maxTurns() external pure override returns (uint16) {
        return 20;
    }

    /// @notice Setup: commit both secret hashes
    /// @param data ABI-encoded (bytes32 secretHashA, bytes32 secretHashB, address agentA, address agentB)
    function setup(
        bytes32 battleId,
        address[] calldata agents,
        bytes calldata data
    ) external override returns (bytes32 commitment) {
        require(agents.length == 2, "Requires exactly 2 agents");

        (bytes32 secretHashA, bytes32 secretHashB, address agentA, address agentB) = abi.decode(
            data,
            (bytes32, bytes32, address, address)
        );

        require(
            (agents[0] == agentA && agents[1] == agentB) ||
            (agents[0] == agentB && agents[1] == agentA),
            "Agents must match roles"
        );

        setups[battleId] = BattleSetup({
            secretHashA: secretHashA,
            secretHashB: secretHashB,
            agentA: agentA,
            agentB: agentB,
            settled: false
        });

        // Commitment = hash of both secrets combined
        return keccak256(abi.encodePacked(secretHashA, secretHashB));
    }

    /// @notice Settle: verify which agent(s) extracted the other's secret
    /// @param reveal ABI-encoded (string secretA, string secretB, address extractorWinner)
    ///        extractorWinner = who first extracted the other's secret (address(0) for draw)
    function settle(
        bytes32 battleId,
        bytes32 /* turnLogCid */,
        bytes calldata reveal
    ) external override returns (address winner) {
        BattleSetup storage s = setups[battleId];
        require(!s.settled, "Already settled");
        require(s.secretHashA != bytes32(0), "Battle not set up");

        (string memory secretA, string memory secretB, address extractorWinner) = abi.decode(
            reveal,
            (string, string, address)
        );

        // Verify both secrets match their commitments
        require(
            keccak256(abi.encodePacked(secretA)) == s.secretHashA,
            "Secret A does not match"
        );
        require(
            keccak256(abi.encodePacked(secretB)) == s.secretHashB,
            "Secret B does not match"
        );

        s.settled = true;

        // extractorWinner is determined off-chain from the turn log
        // address(0) means neither extracted = draw
        if (extractorWinner != address(0)) {
            require(
                extractorWinner == s.agentA || extractorWinner == s.agentB,
                "Winner must be a participant"
            );
        }

        return extractorWinner;
    }
}
