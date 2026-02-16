// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IScenario.sol";

/// @title ClawttackRegistry — Battle creation, settlement, and Elo tracking
/// @notice The core contract for the Clawttack protocol.
///         Handles escrow, outcome verification, and on-chain reputation.
contract ClawttackRegistry {
    // --- Types ---

    enum BattleState { Created, Active, Settled, Cancelled }

    struct Battle {
        bytes32 id;
        address scenario;           // IScenario contract address
        address[] agents;
        BattleState state;
        uint256 entryFee;           // Per agent, held in escrow
        bytes32 commitment;         // From scenario.setup()
        bytes32 turnLogCid;         // IPFS CID of signed turn log
        address winner;
        uint256 createdAt;
        uint256 settledAt;
    }

    struct AgentStats {
        uint32 elo;
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint256 lastActiveAt;
    }

    // --- State ---

    mapping(bytes32 => Battle) public battles;
    mapping(address => AgentStats) public agents;
    
    uint256 public protocolFeeRate = 500; // 5% (basis points)
    address public owner;
    address public feeRecipient;
    
    uint32 public constant DEFAULT_ELO = 1200;
    uint32 public constant K_FACTOR = 32;

    // --- Events ---

    event BattleCreated(
        bytes32 indexed battleId,
        address indexed scenario,
        address[] agents,
        uint256 entryFee,
        bytes32 commitment
    );

    event BattleSettled(
        bytes32 indexed battleId,
        address indexed winner,
        bytes32 turnLogCid,
        uint256 payout
    );

    event BattleCancelled(bytes32 indexed battleId);

    event AgentRegistered(address indexed agent, uint32 elo);

    event EloUpdated(
        address indexed agent,
        uint32 oldElo,
        uint32 newElo
    );

    // --- Errors ---

    error BattleNotFound();
    error BattleNotInState(BattleState expected, BattleState actual);
    error NotParticipant();
    error InsufficientFee();
    error InvalidWinner();
    error Unauthorized();

    // --- Constructor ---

    constructor(address _feeRecipient) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
    }

    // --- Agent Registration ---

    /// @notice Register an agent (or update lastActiveAt)
    function registerAgent() external {
        if (agents[msg.sender].elo == 0) {
            agents[msg.sender] = AgentStats({
                elo: DEFAULT_ELO,
                wins: 0,
                losses: 0,
                draws: 0,
                lastActiveAt: block.timestamp
            });
            emit AgentRegistered(msg.sender, DEFAULT_ELO);
        } else {
            agents[msg.sender].lastActiveAt = block.timestamp;
        }
    }

    // --- Battle Lifecycle ---

    /// @notice Create a battle with escrow
    /// @param battleId Unique identifier (should be generated off-chain)
    /// @param scenario Address of the IScenario contract
    /// @param agentAddresses Participant addresses (must include msg.sender)
    /// @param setupData Scenario-specific setup data
    function createBattle(
        bytes32 battleId,
        address scenario,
        address[] calldata agentAddresses,
        bytes calldata setupData
    ) external payable {
        if (battles[battleId].createdAt != 0) revert BattleNotFound(); // Already exists
        
        uint256 entryFee = msg.value;

        // Call scenario setup
        bytes32 commitment = IScenario(scenario).setup(
            battleId,
            agentAddresses,
            setupData
        );

        battles[battleId] = Battle({
            id: battleId,
            scenario: scenario,
            agents: agentAddresses,
            state: BattleState.Active,
            entryFee: entryFee,
            commitment: commitment,
            turnLogCid: bytes32(0),
            winner: address(0),
            createdAt: block.timestamp,
            settledAt: 0
        });

        // Auto-register agents if new
        for (uint256 i = 0; i < agentAddresses.length; i++) {
            if (agents[agentAddresses[i]].elo == 0) {
                agents[agentAddresses[i]] = AgentStats({
                    elo: DEFAULT_ELO,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    lastActiveAt: block.timestamp
                });
                emit AgentRegistered(agentAddresses[i], DEFAULT_ELO);
            }
        }

        emit BattleCreated(battleId, scenario, agentAddresses, entryFee, commitment);
    }

    /// @notice Settle a battle — anyone with the reveal can call this
    /// @param battleId Battle to settle
    /// @param turnLogCid IPFS CID of the full signed turn log
    /// @param reveal Scenario-specific reveal data
    function settle(
        bytes32 battleId,
        bytes32 turnLogCid,
        bytes calldata reveal
    ) external {
        Battle storage battle = battles[battleId];
        if (battle.createdAt == 0) revert BattleNotFound();
        if (battle.state != BattleState.Active) {
            revert BattleNotInState(BattleState.Active, battle.state);
        }

        // Let the scenario determine the winner
        address winner = IScenario(battle.scenario).settle(
            battleId,
            turnLogCid,
            reveal
        );

        // Validate winner is a participant (or address(0) for draw)
        if (winner != address(0)) {
            bool isParticipant = false;
            for (uint256 i = 0; i < battle.agents.length; i++) {
                if (battle.agents[i] == winner) {
                    isParticipant = true;
                    break;
                }
            }
            if (!isParticipant) revert InvalidWinner();
        }

        // Update battle state
        battle.state = BattleState.Settled;
        battle.winner = winner;
        battle.turnLogCid = turnLogCid;
        battle.settledAt = block.timestamp;

        // Update Elo ratings
        _updateElo(battle.agents, winner);

        // Distribute funds
        uint256 totalPool = battle.entryFee;
        if (totalPool > 0 && winner != address(0)) {
            uint256 fee = (totalPool * protocolFeeRate) / 10000;
            uint256 payout = totalPool - fee;

            // Pay winner
            (bool sent, ) = winner.call{value: payout}("");
            require(sent, "Payout failed");

            // Pay protocol fee
            if (fee > 0) {
                (bool feeSent, ) = feeRecipient.call{value: fee}("");
                require(feeSent, "Fee transfer failed");
            }

            emit BattleSettled(battleId, winner, turnLogCid, payout);
        } else {
            emit BattleSettled(battleId, winner, turnLogCid, 0);
        }
    }

    // --- Elo ---

    function _updateElo(address[] storage players, address winner) internal {
        if (players.length != 2) return; // Only 1v1 for now

        address a = players[0];
        address b = players[1];
        uint32 eloA = agents[a].elo;
        uint32 eloB = agents[b].elo;

        // Expected scores (simplified integer math)
        // E_A = 1 / (1 + 10^((eloB - eloA) / 400))
        // Using fixed-point: multiply by 1000 for precision
        int256 diff = int256(uint256(eloB)) - int256(uint256(eloA));
        
        // Approximate expected score (linear for small diff, capped)
        uint32 expectedA;
        if (diff > 400) expectedA = 100;      // ~0.1
        else if (diff < -400) expectedA = 900; // ~0.9  
        else expectedA = uint32(uint256(int256(500) - diff * 500 / 400)); // Linear approx

        uint32 expectedB = 1000 - expectedA;

        uint32 scoreA;
        uint32 scoreB;

        if (winner == address(0)) {
            // Draw
            scoreA = 500;
            scoreB = 500;
            agents[a].draws++;
            agents[b].draws++;
        } else if (winner == a) {
            scoreA = 1000;
            scoreB = 0;
            agents[a].wins++;
            agents[b].losses++;
        } else {
            scoreA = 0;
            scoreB = 1000;
            agents[b].wins++;
            agents[a].losses++;
        }

        // New Elo = Old + K * (Score - Expected) / 1000
        uint32 newEloA = _clampElo(int256(uint256(eloA)) + int256(uint256(K_FACTOR)) * (int256(uint256(scoreA)) - int256(uint256(expectedA))) / 1000);
        uint32 newEloB = _clampElo(int256(uint256(eloB)) + int256(uint256(K_FACTOR)) * (int256(uint256(scoreB)) - int256(uint256(expectedB))) / 1000);

        if (newEloA != eloA) {
            agents[a].elo = newEloA;
            emit EloUpdated(a, eloA, newEloA);
        }
        if (newEloB != eloB) {
            agents[b].elo = newEloB;
            emit EloUpdated(b, eloB, newEloB);
        }

        agents[a].lastActiveAt = block.timestamp;
        agents[b].lastActiveAt = block.timestamp;
    }

    function _clampElo(int256 elo) internal pure returns (uint32) {
        if (elo < 100) return 100;
        if (elo > 3000) return 3000;
        return uint32(uint256(elo));
    }

    // --- Views ---

    function getBattle(bytes32 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getAgent(address agent) external view returns (AgentStats memory) {
        return agents[agent];
    }

    // --- Admin ---

    function setProtocolFeeRate(uint256 newRate) external {
        if (msg.sender != owner) revert Unauthorized();
        require(newRate <= 1000, "Max 10%");
        protocolFeeRate = newRate;
    }

    function setFeeRecipient(address newRecipient) external {
        if (msg.sender != owner) revert Unauthorized();
        feeRecipient = newRecipient;
    }
}
