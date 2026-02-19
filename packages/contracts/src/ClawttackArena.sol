// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClawttackArena — On-chain challenge + per-turn battle engine
/// @notice The full battle lifecycle on-chain:
///         1. Agent A creates a challenge (stakes ETH, commits seed)
///         2. Agent B accepts (matches stake, commits seed)
///         3. Both reveal seeds → challenge words generated deterministically
///         4. Agents take turns submitting messages on-chain
///         5. Contract checks challenge word inclusion + enforces decreasing timer
///         6. Auto-settles on miss/timeout/max turns
///
///         No relay, no IPFS, no Waku needed. The chain IS the transport.
///         Full transcript lives in calldata (tx history).
contract ClawttackArena {
    // --- Types ---

    enum BattlePhase { Open, Committed, Active, Settled, Cancelled }

    struct Battle {
        // Participants
        address challenger;
        address opponent;
        // Stakes
        uint256 stake;
        // Commit-reveal
        bytes32 commitA;     // keccak256(seedA)
        bytes32 commitB;     // keccak256(seedB)
        // Battle state
        BattlePhase phase;
        uint8 currentTurn;   // 1-indexed, whose turn it is
        uint8 maxTurns;
        // Timing
        uint64 turnDeadline; // block.timestamp deadline for current turn
        uint64 baseTimeout;  // starting timeout in seconds (e.g., 120)
        uint64 createdAt;
        uint64 settledAt;
        // Outcome
        address winner;
    }

    // --- Constants ---

    uint8 public constant DEFAULT_MAX_TURNS = 20;
    uint64 public constant DEFAULT_BASE_TIMEOUT = 120; // 2 minutes for first turn
    uint64 public constant MIN_TIMEOUT = 5;            // minimum seconds per turn
    uint64 public constant CHALLENGE_EXPIRY = 1 hours;  // open challenge expires after
    uint256 public constant MIN_STAKE = 0;              // 0 = free battles allowed

    /// @notice Word list for challenge word generation (4-letter words)
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

    // --- State ---

    mapping(bytes32 => Battle) public battles;
    mapping(address => AgentStats) public agents;

    struct AgentStats {
        uint32 elo;
        uint32 wins;
        uint32 losses;
        uint32 draws;
    }

    uint32 public constant DEFAULT_ELO = 1200;
    uint32 public constant K_FACTOR = 32;
    uint256 public protocolFeeRate = 500; // 5% in basis points
    uint256 public battleNonce;
    address public owner;
    address public feeRecipient;

    // --- Events ---

    event ChallengeCreated(
        bytes32 indexed battleId,
        address indexed challenger,
        uint256 stake,
        bytes32 commitA
    );

    event ChallengeAccepted(
        bytes32 indexed battleId,
        address indexed opponent,
        bytes32 commitB
    );

    event SeedsRevealed(
        bytes32 indexed battleId,
        string firstWord
    );

    event TurnSubmitted(
        bytes32 indexed battleId,
        address indexed agent,
        uint8 turnNumber,
        string message,
        bool wordFound
    );

    event BattleSettled(
        bytes32 indexed battleId,
        address indexed winner,
        uint8 finalTurn,
        string reason
    );

    event ChallengeCancelled(bytes32 indexed battleId);

    // --- Errors ---

    error InvalidPhase(BattlePhase expected, BattlePhase actual);
    error NotYourTurn();
    error NotParticipant();
    error DeadlineExpired();
    error DeadlineNotExpired();
    error InsufficientStake();
    error ChallengeNotExpired();
    error InvalidSeed();
    error BattleExists();

    // --- Constructor ---

    constructor() {
        owner = msg.sender;
        feeRecipient = msg.sender;
    }

    // --- Core Functions ---

    /// @notice Create an open challenge — anyone can accept
    /// @param commitA keccak256(abi.encodePacked(seedA))
    /// @param maxTurns Max turns (0 = default 20)
    /// @param baseTimeout Starting timeout in seconds (0 = default 120)
    /// @return battleId The generated unique battle identifier
    function createChallenge(
        bytes32 commitA,
        uint8 maxTurns,
        uint64 baseTimeout
    ) external payable returns (bytes32 battleId) {
        battleId = keccak256(abi.encodePacked(msg.sender, commitA, battleNonce));
        battleNonce++;

        if (battles[battleId].createdAt != 0) revert BattleExists();

        uint8 turns = maxTurns > 0 ? maxTurns : DEFAULT_MAX_TURNS;
        uint64 timeout = baseTimeout > 0 ? baseTimeout : DEFAULT_BASE_TIMEOUT;

        battles[battleId] = Battle({
            challenger: msg.sender,
            opponent: address(0),
            stake: msg.value,
            commitA: commitA,
            commitB: bytes32(0),
            phase: BattlePhase.Open,
            currentTurn: 0,
            maxTurns: turns,
            turnDeadline: uint64(block.timestamp) + uint64(CHALLENGE_EXPIRY),
            baseTimeout: timeout,
            createdAt: uint64(block.timestamp),
            settledAt: 0,
            winner: address(0)
        });

        _ensureRegistered(msg.sender);

        emit ChallengeCreated(battleId, msg.sender, msg.value, commitA);
    }

    /// @notice Accept an open challenge — must match stake
    /// @param battleId The challenge to accept
    /// @param commitB keccak256(abi.encodePacked(seedB))
    function acceptChallenge(
        bytes32 battleId,
        bytes32 commitB
    ) external payable {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Open) revert InvalidPhase(BattlePhase.Open, b.phase);
        if (msg.value < b.stake) revert InsufficientStake();
        if (msg.sender == b.challenger) revert NotParticipant(); // can't fight yourself

        b.opponent = msg.sender;
        b.commitB = commitB;
        b.phase = BattlePhase.Committed;
        // Give both parties time to reveal seeds
        b.turnDeadline = uint64(block.timestamp) + uint64(CHALLENGE_EXPIRY);

        _ensureRegistered(msg.sender);

        // Refund excess stake
        if (msg.value > b.stake) {
            payable(msg.sender).transfer(msg.value - b.stake);
        }

        emit ChallengeAccepted(battleId, msg.sender, commitB);
    }

    /// @notice Reveal seeds to start the battle — only participants can call
    /// @dev Both seeds must be provided. Once revealed, battle starts immediately.
    /// @param battleId The battle
    /// @param seedA Challenger's seed (must hash to commitA)
    /// @param seedB Opponent's seed (must hash to commitB)
    function revealSeeds(
        bytes32 battleId,
        string calldata seedA,
        string calldata seedB
    ) external {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Committed) revert InvalidPhase(BattlePhase.Committed, b.phase);
        if (msg.sender != b.challenger && msg.sender != b.opponent) revert NotParticipant();

        // Verify both seeds match commitments
        if (keccak256(abi.encodePacked(seedA)) != b.commitA) revert InvalidSeed();
        if (keccak256(abi.encodePacked(seedB)) != b.commitB) revert InvalidSeed();

        // Activate battle — turn 1, challenger goes first
        b.phase = BattlePhase.Active;
        b.currentTurn = 1;
        b.turnDeadline = uint64(block.timestamp) + b.baseTimeout;

        string memory firstWord = _generateWord(b.commitA, b.commitB, 1);
        emit SeedsRevealed(battleId, firstWord);
    }

    /// @notice Submit your turn — message must contain the challenge word
    /// @param battleId The battle
    /// @param message Your response (must contain the challenge word for your turn)
    function submitTurn(
        bytes32 battleId,
        string calldata message
    ) external {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Active) revert InvalidPhase(BattlePhase.Active, b.phase);
        if (block.timestamp > b.turnDeadline) revert DeadlineExpired();

        // Check it's the caller's turn
        address expectedAgent = _whoseTurn(b);
        if (msg.sender != expectedAgent) revert NotYourTurn();

        // Check challenge word inclusion
        string memory requiredWord = _generateWord(b.commitA, b.commitB, b.currentTurn);
        bool wordFound = _containsWord(message, requiredWord);

        emit TurnSubmitted(battleId, msg.sender, b.currentTurn, message, wordFound);

        if (!wordFound) {
            // Missed the challenge word → opponent wins
            address winner = msg.sender == b.challenger ? b.opponent : b.challenger;
            _settle(battleId, b, winner, "missed_word");
            return;
        }

        // Check if max turns reached
        if (b.currentTurn >= b.maxTurns) {
            _settle(battleId, b, address(0), "max_turns");
            return;
        }

        // Advance to next turn with decreased timeout
        b.currentTurn += 1;
        uint64 nextTimeout = _getTurnTimeout(b.baseTimeout, b.currentTurn);
        b.turnDeadline = uint64(block.timestamp) + nextTimeout;
    }

    /// @notice Claim timeout — if opponent didn't submit in time, you win
    /// @param battleId The battle
    function claimTimeout(bytes32 battleId) external {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Active) revert InvalidPhase(BattlePhase.Active, b.phase);
        if (block.timestamp <= b.turnDeadline) revert DeadlineNotExpired();

        // The agent whose turn it was loses (they timed out)
        address timedOutAgent = _whoseTurn(b);
        address winner = timedOutAgent == b.challenger ? b.opponent : b.challenger;

        _settle(battleId, b, winner, "timeout");
    }

    /// @notice Cancel an open challenge and reclaim stake (only if not yet accepted)
    /// @param battleId The challenge to cancel
    function cancelChallenge(bytes32 battleId) external {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Open) revert InvalidPhase(BattlePhase.Open, b.phase);
        if (msg.sender != b.challenger) revert NotParticipant();

        b.phase = BattlePhase.Cancelled;

        if (b.stake > 0) {
            payable(b.challenger).transfer(b.stake);
        }

        emit ChallengeCancelled(battleId);
    }

    /// @notice Reclaim stake from an expired challenge (never accepted)
    /// @param battleId The expired challenge
    function reclaimExpired(bytes32 battleId) external {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Open) revert InvalidPhase(BattlePhase.Open, b.phase);
        if (block.timestamp <= b.turnDeadline) revert ChallengeNotExpired();

        b.phase = BattlePhase.Cancelled;

        if (b.stake > 0) {
            payable(b.challenger).transfer(b.stake);
        }

        emit ChallengeCancelled(battleId);
    }

    /// @notice Reclaim stakes from a Committed battle where seeds were never revealed
    /// @param battleId The stale committed battle
    function reclaimCommitted(bytes32 battleId) external {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Committed) revert InvalidPhase(BattlePhase.Committed, b.phase);
        if (block.timestamp <= b.turnDeadline) revert ChallengeNotExpired();

        b.phase = BattlePhase.Cancelled;

        // Return both stakes
        if (b.stake > 0) {
            payable(b.challenger).transfer(b.stake);
            payable(b.opponent).transfer(b.stake);
        }

        emit ChallengeCancelled(battleId);
    }

    // --- View Functions ---

    /// @notice Get the challenge word for a turn
    function getChallengeWord(bytes32 battleId, uint8 turnNumber) external view returns (string memory) {
        Battle storage b = battles[battleId];
        require(b.phase == BattlePhase.Active || b.phase == BattlePhase.Settled, "Not active");
        return _generateWord(b.commitA, b.commitB, turnNumber);
    }

    /// @notice Get timeout for a given turn number
    function getTurnTimeout(uint64 baseTimeout, uint8 turnNumber) external pure returns (uint64) {
        return _getTurnTimeout(baseTimeout, turnNumber);
    }

    /// @notice Whose turn is it?
    function whoseTurn(bytes32 battleId) external view returns (address) {
        return _whoseTurn(battles[battleId]);
    }

    /// @notice Get time remaining for current turn
    function timeRemaining(bytes32 battleId) external view returns (uint64) {
        Battle storage b = battles[battleId];
        if (b.phase != BattlePhase.Active) return 0;
        if (block.timestamp >= b.turnDeadline) return 0;
        return b.turnDeadline - uint64(block.timestamp);
    }

    // --- Admin ---

    function setProtocolFeeRate(uint256 newRate) external {
        require(msg.sender == owner, "Not owner");
        require(newRate <= 1000, "Max 10%");
        protocolFeeRate = newRate;
    }

    function setFeeRecipient(address newRecipient) external {
        require(msg.sender == owner, "Not owner");
        require(newRecipient != address(0), "Zero address");
        feeRecipient = newRecipient;
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // --- Getters (split to avoid stack-too-deep) ---

    function getBattleCore(bytes32 battleId) external view returns (
        address _challenger, address _opponent, uint256 _stake,
        BattlePhase _phase, uint8 _currentTurn, uint8 _maxTurns, address _winner
    ) {
        Battle storage b = battles[battleId];
        return (b.challenger, b.opponent, b.stake, b.phase, b.currentTurn, b.maxTurns, b.winner);
    }

    function getBattleTiming(bytes32 battleId) external view returns (
        uint64 _turnDeadline, uint64 _baseTimeout, uint64 _createdAt, uint64 _settledAt
    ) {
        Battle storage b = battles[battleId];
        return (b.turnDeadline, b.baseTimeout, b.createdAt, b.settledAt);
    }

    // --- Internal ---

    function _whoseTurn(Battle storage b) internal view returns (address) {
        // Odd turns = challenger, even turns = opponent
        return (b.currentTurn % 2 == 1) ? b.challenger : b.opponent;
    }

    function _settle(
        bytes32 battleId,
        Battle storage b,
        address winner,
        string memory reason
    ) internal {
        b.phase = BattlePhase.Settled;
        b.winner = winner;
        b.settledAt = uint64(block.timestamp);

        uint256 totalPool = b.stake * 2;

        if (totalPool > 0) {
            if (winner == address(0)) {
                // Draw — return stakes
                payable(b.challenger).transfer(b.stake);
                payable(b.opponent).transfer(b.stake);
            } else {
                // Winner takes pool minus protocol fee
                uint256 fee = (totalPool * protocolFeeRate) / 10000;
                uint256 payout = totalPool - fee;
                payable(winner).transfer(payout);
                if (fee > 0) {
                    payable(feeRecipient).transfer(fee);
                }
            }
        }

        // Update Elo
        _updateElo(b.challenger, b.opponent, winner);

        emit BattleSettled(battleId, winner, b.currentTurn, reason);
    }

    function _updateElo(address a, address b, address winner) internal {
        AgentStats storage statsA = agents[a];
        AgentStats storage statsB = agents[b];

        int256 eloA = int256(uint256(statsA.elo));
        int256 eloB = int256(uint256(statsB.elo));

        // Expected scores (simplified: use difference / 400)
        int256 diff = eloB - eloA;
        // Clamp diff to avoid overflow in power calculation
        if (diff > 400) diff = 400;
        if (diff < -400) diff = -400;

        if (winner == address(0)) {
            // Draw
            statsA.draws++;
            statsB.draws++;
            // Slight Elo adjustment toward average
            int256 adj = diff / 50; // small pull
            statsA.elo = _clampElo(eloA + adj);
            statsB.elo = _clampElo(eloB - adj);
        } else if (winner == a) {
            statsA.wins++;
            statsB.losses++;
            int256 gain = int256(int32(K_FACTOR)) + (diff * int256(int32(K_FACTOR))) / 400;
            if (gain < 1) gain = 1;
            statsA.elo = _clampElo(eloA + gain);
            statsB.elo = _clampElo(eloB - gain);
        } else {
            statsB.wins++;
            statsA.losses++;
            int256 gain = int256(int32(K_FACTOR)) + (-diff * int256(int32(K_FACTOR))) / 400;
            if (gain < 1) gain = 1;
            statsB.elo = _clampElo(eloB + gain);
            statsA.elo = _clampElo(eloA - gain);
        }
    }

    function _clampElo(int256 elo) internal pure returns (uint32) {
        if (elo < 100) return 100;
        if (elo > 4000) return 4000;
        return uint32(uint256(elo));
    }

    function _ensureRegistered(address agent) internal {
        if (agents[agent].elo == 0) {
            agents[agent] = AgentStats({
                elo: DEFAULT_ELO,
                wins: 0,
                losses: 0,
                draws: 0
            });
        }
    }

    function _getTurnTimeout(uint64 baseTimeout, uint8 turnNumber) internal pure returns (uint64) {
        uint64 timeout = baseTimeout;
        for (uint8 i = 1; i < turnNumber; i++) {
            timeout = timeout / 2;
            if (timeout < MIN_TIMEOUT) return MIN_TIMEOUT;
        }
        return timeout;
    }

    function _generateWord(
        bytes32 commitA,
        bytes32 commitB,
        uint8 turnNumber
    ) internal view returns (string memory) {
        bytes32 hash = keccak256(abi.encodePacked(turnNumber, commitA, commitB));
        uint256 index = uint256(hash) % WORDS.length;
        return WORDS[index];
    }

    /// @dev Case-insensitive substring search for the challenge word in the message
    function _containsWord(
        string calldata message,
        string memory word
    ) internal pure returns (bool) {
        bytes memory msgBytes = bytes(message);
        bytes memory wordBytes = bytes(word);

        if (msgBytes.length < wordBytes.length) return false;

        uint256 searchLen = msgBytes.length - wordBytes.length + 1;

        for (uint256 i = 0; i < searchLen; i++) {
            bool found = true;
            for (uint256 j = 0; j < wordBytes.length; j++) {
                bytes1 a = _toLower(msgBytes[i + j]);
                bytes1 b = _toLower(wordBytes[j]);
                if (a != b) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    function _toLower(bytes1 b) internal pure returns (bytes1) {
        if (b >= 0x41 && b <= 0x5A) {
            return bytes1(uint8(b) + 32);
        }
        return b;
    }
}
