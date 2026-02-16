// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Clawttack — Agent Battle Arena Registry
 * @notice On-chain registry for AI agent battles with cryptographic outcome verification.
 * @dev Integrates with ERC-8004 (agent identity) and ERC-8021 (builder attribution).
 *
 * Flow:
 *   1. commitBattle() — hash of secret is stored before battle starts
 *   2. settleBattle() — winner + secret submitted; hash verified on-chain
 *   3. Agent records (wins/losses/elo) updated automatically
 *
 * ERC-8021 attribution: builder codes embedded in settlement tx calldata.
 */
contract ClawttackRegistry {
    // --- Structs ---

    struct Battle {
        bytes32 secretHash;      // keccak256(secret) — committed before battle
        uint256[] agentIds;      // ERC-8004 agent IDs participating
        uint256 winnerId;        // 0 = not settled or draw
        bool settled;
        uint64 createdAt;
        uint64 settledAt;
        string scenarioId;       // e.g., "injection-ctf"
    }

    struct AgentRecord {
        uint256 wins;
        uint256 losses;
        uint256 draws;
        uint256 elo;
        uint256 totalBattles;
        bool registered;
    }

    // --- State ---

    mapping(bytes32 => Battle) public battles;
    mapping(uint256 => AgentRecord) public agentRecords;

    address public owner;
    address public operator; // The Clawttack orchestrator (can commit/settle)

    uint256 public totalBattles;
    uint256 public constant DEFAULT_ELO = 1200;
    uint256 public constant K_FACTOR = 32;

    // --- Events ---

    event BattleCommitted(
        bytes32 indexed battleId,
        bytes32 secretHash,
        uint256[] agentIds,
        string scenarioId
    );

    event BattleSettled(
        bytes32 indexed battleId,
        uint256 indexed winnerId,
        bytes32 secretHash,
        bool verified
    );

    event AgentRegistered(uint256 indexed agentId);

    // --- Errors ---

    error NotOperator();
    error BattleAlreadyExists();
    error BattleNotFound();
    error BattleAlreadySettled();
    error InvalidVerification();
    error AgentNotRegistered();

    // --- Modifiers ---

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner) revert NotOperator();
        _;
    }

    // --- Constructor ---

    constructor(address _operator) {
        owner = msg.sender;
        operator = _operator;
    }

    // --- Agent Registration ---

    /**
     * @notice Register an ERC-8004 agent for battles.
     * @param agentId The ERC-8004 token ID.
     */
    function registerAgent(uint256 agentId) external onlyOperator {
        if (!agentRecords[agentId].registered) {
            agentRecords[agentId] = AgentRecord({
                wins: 0,
                losses: 0,
                draws: 0,
                elo: DEFAULT_ELO,
                totalBattles: 0,
                registered: true
            });
            emit AgentRegistered(agentId);
        }
    }

    // --- Battle Lifecycle ---

    /**
     * @notice Commit a battle before it starts.
     * @dev The secret hash is stored on-chain for later verification.
     * @param battleId Unique battle identifier.
     * @param secretHash keccak256 hash of the secret phrase.
     * @param agentIds Array of ERC-8004 agent IDs participating.
     * @param scenarioId The scenario type (e.g., "injection-ctf").
     */
    function commitBattle(
        bytes32 battleId,
        bytes32 secretHash,
        uint256[] calldata agentIds,
        string calldata scenarioId
    ) external onlyOperator {
        if (battles[battleId].createdAt != 0) revert BattleAlreadyExists();

        battles[battleId] = Battle({
            secretHash: secretHash,
            agentIds: agentIds,
            winnerId: 0,
            settled: false,
            createdAt: uint64(block.timestamp),
            settledAt: 0,
            scenarioId: scenarioId
        });

        totalBattles++;
        emit BattleCommitted(battleId, secretHash, agentIds, scenarioId);
    }

    /**
     * @notice Settle a battle with the outcome.
     * @dev Verifies the secret against the committed hash.
     *      ERC-8021 builder attribution should be included in tx calldata.
     * @param battleId The battle to settle.
     * @param winnerId ERC-8004 agent ID of the winner (0 for draw).
     * @param secret The revealed secret (verified against commitment).
     */
    function settleBattle(
        bytes32 battleId,
        uint256 winnerId,
        string calldata secret
    ) external onlyOperator {
        Battle storage battle = battles[battleId];
        if (battle.createdAt == 0) revert BattleNotFound();
        if (battle.settled) revert BattleAlreadySettled();

        // Verify secret against commitment
        bytes32 revealedHash = keccak256(abi.encodePacked(secret));
        bool verified = (revealedHash == battle.secretHash);
        if (!verified) revert InvalidVerification();

        battle.winnerId = winnerId;
        battle.settled = true;
        battle.settledAt = uint64(block.timestamp);

        // Update agent records
        _updateRecords(battle.agentIds, winnerId);

        emit BattleSettled(battleId, winnerId, battle.secretHash, verified);
    }

    // --- Internal ---

    function _updateRecords(uint256[] storage agentIds, uint256 winnerId) internal {
        if (agentIds.length != 2) return; // Only 1v1 Elo for now

        uint256 id1 = agentIds[0];
        uint256 id2 = agentIds[1];

        AgentRecord storage r1 = agentRecords[id1];
        AgentRecord storage r2 = agentRecords[id2];

        if (!r1.registered || !r2.registered) return;

        r1.totalBattles++;
        r2.totalBattles++;

        if (winnerId == 0) {
            // Draw
            r1.draws++;
            r2.draws++;
            (r1.elo, r2.elo) = _calculateElo(r1.elo, r2.elo, 1); // 0=a_wins, 1=draw, 2=b_wins
        } else if (winnerId == id1) {
            r1.wins++;
            r2.losses++;
            (r1.elo, r2.elo) = _calculateElo(r1.elo, r2.elo, 0);
        } else if (winnerId == id2) {
            r1.losses++;
            r2.wins++;
            (r1.elo, r2.elo) = _calculateElo(r1.elo, r2.elo, 2);
        }
    }

    /**
     * @notice Calculate new Elo ratings.
     * @param eloA Rating of player A.
     * @param eloB Rating of player B.
     * @param result 0 = A wins, 1 = draw, 2 = B wins.
     */
    function _calculateElo(
        uint256 eloA,
        uint256 eloB,
        uint256 result
    ) internal pure returns (uint256 newA, uint256 newB) {
        // Simplified Elo: use fixed-point math
        // Expected score = 1 / (1 + 10^((ratingB - ratingA)/400))
        // For simplicity in Solidity, use linear approximation
        int256 diff = int256(eloA) - int256(eloB);
        
        // Clamp diff to [-400, 400] for simplified calculation
        if (diff > 400) diff = 400;
        if (diff < -400) diff = -400;

        // expectedA ≈ 0.5 + diff/800 (linear approximation, scaled by 100)
        int256 expectedA100 = 50 + (diff * 50) / 400;

        int256 scoreA100;
        if (result == 0) scoreA100 = 100;      // A wins
        else if (result == 1) scoreA100 = 50;   // Draw
        else scoreA100 = 0;                      // B wins

        int256 deltaA = (int256(K_FACTOR) * (scoreA100 - expectedA100)) / 100;

        newA = uint256(int256(eloA) + deltaA);
        newB = uint256(int256(eloB) - deltaA);

        // Floor at 100
        if (newA < 100) newA = 100;
        if (newB < 100) newB = 100;
    }

    // --- Views ---

    function getBattle(bytes32 battleId) external view returns (
        bytes32 secretHash,
        uint256 winnerId,
        bool settled,
        uint64 createdAt,
        uint64 settledAt,
        string memory scenarioId
    ) {
        Battle storage b = battles[battleId];
        return (b.secretHash, b.winnerId, b.settled, b.createdAt, b.settledAt, b.scenarioId);
    }

    function getAgentRecord(uint256 agentId) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 draws,
        uint256 elo,
        uint256 totalBattlesCount,
        bool registered
    ) {
        AgentRecord storage r = agentRecords[agentId];
        return (r.wins, r.losses, r.draws, r.elo, r.totalBattles, r.registered);
    }

    // --- Admin ---

    function setOperator(address _operator) external {
        require(msg.sender == owner, "Not owner");
        operator = _operator;
    }
}
