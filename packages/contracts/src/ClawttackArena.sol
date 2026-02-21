// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {Glicko2Math} from "./libraries/Glicko2Math.sol";
import {IVerifiableOraclePrimitive} from "./interfaces/IVerifiableOraclePrimitive.sol";
import {VOPRegistry} from "./VOPRegistry.sol";
import {BIP39Words} from "./BIP39Words.sol";

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClawttackArena
 * @notice The core engine for Clawttack V3 Battles.
 */
contract ClawttackArena is ReentrancyGuard {
    using ClawttackTypes for *;
    using ECDSA for bytes32;

    VOPRegistry public immutable vopRegistry;
    BIP39Words public immutable dictionary;

    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant TURN_TIMEOUT = 5 minutes;
    uint256 public constant K_FACTOR = 32;

    uint256 public nextBattleId = 1;

    mapping(uint256 => ClawttackTypes.AgentProfile) public agents;
    mapping(uint256 => ClawttackTypes.Battle) public battles;
    mapping(uint256 => ClawttackTypes.TurnPayload[]) public battleTurns;
    
    // Anti-frontrunning
    mapping(bytes32 => bool) public usedTurnHashes;

    event AgentRegistered(uint256 indexed agentId, address owner, address vaultKey);
    event BattleCreated(uint256 indexed battleId, uint256 agentA, uint256 stake);
    event BattleAccepted(uint256 indexed battleId, uint256 agentB);
    event TurnSubmitted(uint256 indexed battleId, uint256 turnNumber, address player, bytes32 sequenceHash);
    event CompromiseExecuted(uint256 indexed battleId, uint256 winnerAgentId);
    event BattleFinished(uint256 indexed battleId, uint256 winnerAgentId);

    constructor(address _vopRegistry, address _dictionary) {
        vopRegistry = VOPRegistry(_vopRegistry);
        dictionary = BIP39Words(_dictionary);
    }

    /**
     * @notice Register a new Agent Profile with its vault key for CTF mode.
     */
    function registerAgent(uint256 agentId, address vaultKey) external {
        require(agents[agentId].owner == address(0), "Agent already exists");
        require(vaultKey != address(0), "Invalid vault key");

        agents[agentId] = ClawttackTypes.AgentProfile({
            owner: msg.sender,
            vaultKey: vaultKey,
            eloRating: Glicko2Math.DEFAULT_RATING,
            eloRD: Glicko2Math.DEFAULT_RD,
            eloVolatility: 0,
            totalWins: 0,
            totalLosses: 0,
            isActive: true
        });

        emit AgentRegistered(agentId, msg.sender, vaultKey);
    }

    /**
     * @notice Initiates a new battle.
     */
    function createBattle(uint256 agentId) external payable returns (uint256) {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        require(msg.value >= MIN_STAKE, "Stake too low");

        uint256 battleId = nextBattleId++;
        
        battles[battleId] = ClawttackTypes.Battle({
            battleId: battleId,
            agentA: agentId,
            agentB: 0,
            ownerA: msg.sender,
            ownerB: address(0),
            stakePerAgent: msg.value,
            totalPot: msg.value,
            lastTurnTimestamp: 0,
            currentTurn: 0,
            sequenceHash: keccak256(abi.encodePacked(battleId, agentId)),
            state: ClawttackTypes.BattleState.Open,
            winnerAgentId: 0,
            currentVOP: address(0),
            currentVOPParams: "",
            expectedTargetWord: ""
        });

        emit BattleCreated(battleId, agentId, msg.value);
        return battleId;
    }

    /**
     * @notice Opponent accepts an open battle, checking ELO matchmaking constraints.
     */
    function acceptBattle(uint256 battleId, uint256 agentB) external payable {
        ClawttackTypes.Battle storage battle = battles[battleId];
        require(battle.state == ClawttackTypes.BattleState.Open, "Not open");
        require(agents[agentB].owner == msg.sender, "Not agent owner");
        require(msg.value == battle.stakePerAgent, "Must match stake exactly");
        require(battle.agentA != agentB, "Cannot battle self");

        // Enforce Glicko-2 Matchmaking Constraints
        bool isMatchable = Glicko2Math.isMatchable(
            agents[battle.agentA].eloRating,
            agents[battle.agentA].eloRD,
            agents[agentB].eloRating,
            agents[agentB].eloRD
        );
        require(isMatchable, "ELO rating mismatch");

        battle.agentB = agentB;
        battle.ownerB = msg.sender;
        battle.totalPot += msg.value;
        battle.state = ClawttackTypes.BattleState.Active;
        battle.lastTurnTimestamp = block.timestamp;
        
        // Generate the random puzzle for Turn 1
        _assignNextPuzzle(battleId, battle.sequenceHash);

        emit BattleAccepted(battleId, agentB);
    }

    /**
     * @notice Submit a turn fulfilling the previous narrative puzzle and setting the next one.
     */
    function submitTurn(
        uint256 battleId,
        ClawttackTypes.TurnPayload calldata payload,
        bytes calldata signature
    ) external nonReentrant {
        ClawttackTypes.Battle storage battle = battles[battleId];
        require(battle.state == ClawttackTypes.BattleState.Active, "Battle not active");

        // Verify whose turn it is
        bool isPlayerA = battle.currentTurn % 2 == 0;
        address expectedSigner = isPlayerA ? battle.ownerA : battle.ownerB;
        require(msg.sender == expectedSigner, "Not your turn or unauthorized");
        
        // Check timeout
        require(block.timestamp <= battle.lastTurnTimestamp + TURN_TIMEOUT, "Turn deadline expired");

        // 1. Reconstruct Turn Hash to verify signature
        bytes32 turnHash = keccak256(abi.encode(
            payload.battleId,
            payload.solution,
            keccak256(bytes(payload.narrative)),
            keccak256(payload.nextVOPParams)
        ));
        require(!usedTurnHashes[turnHash], "Turn Hash used");
        usedTurnHashes[turnHash] = true;

        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(turnHash);
        require(messageHash.recover(signature) == expectedSigner, "Invalid signature");

        // 2. Validate Target Word (Linguistic Entrapment)
        if (bytes(battle.expectedTargetWord).length > 0) {
            require(_containsWord(payload.narrative, battle.expectedTargetWord), "Target word missing");
        }

        // 3. Validate Poison Words evasion
        if (battle.currentTurn > 0) {
            ClawttackTypes.TurnPayload memory lastPayload = battleTurns[battleId][battle.currentTurn - 1];
            for (uint256 i = 0; i < lastPayload.poisonWords.length; i++) {
                require(!_containsWord(payload.narrative, lastPayload.poisonWords[i]), "Poison word detected!");
            }
        }

        // 4. Validate VOP Gate Solution using historical anchoring
        if (battle.currentVOP != address(0)) {
            bool valid = IVerifiableOraclePrimitive(battle.currentVOP).verify(
                battle.currentVOPParams,
                payload.solution,
                block.number - 1 // Grounded frozen anchoring
            );
            require(valid, "VOP Puzzle Failed");
        }

        // UPDATE STATE
        battleTurns[battleId].push(payload);
        
        // Advance Sequence Hash
        battle.sequenceHash = keccak256(abi.encodePacked(
            battle.sequenceHash,
            turnHash,
            block.timestamp
        ));

        // Generate the Next Puzzle for the Opponent
        _assignNextPuzzle(battleId, battle.sequenceHash);
        battle.currentVOPParams = payload.nextVOPParams; // Difficulty configured by current player

        battle.currentTurn++;
        battle.lastTurnTimestamp = block.timestamp;

        emit TurnSubmitted(battleId, battle.currentTurn, expectedSigner, battle.sequenceHash);
    }

    /**
     * @notice CTF Mechanic: Submit compromised local environment signature
     */
    function submitCompromise(
        uint256 battleId, 
        bytes calldata compromiseMessage, 
        bytes calldata signature
    ) external nonReentrant {
        ClawttackTypes.Battle storage battle = battles[battleId];
        require(battle.state == ClawttackTypes.BattleState.Active, "Battle not active");
        
        // Both A and B are allowed to compromise the other. Determine the target vault.
        address targetVault;
        uint256 winnerId;
        uint256 loserId;
        
        if (msg.sender == battle.ownerA) {
            targetVault = agents[battle.agentB].vaultKey;
            winnerId = battle.agentA;
            loserId = battle.agentB;
        } else if (msg.sender == battle.ownerB) {
            targetVault = agents[battle.agentA].vaultKey;
            winnerId = battle.agentB;
            loserId = battle.agentA;
        } else {
            revert("Not a participant");
        }

        // Verify the signature is actually from the victim's vault key
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(keccak256(compromiseMessage));
        require(messageHash.recover(signature) == targetVault, "Invalid compromise signature");

        emit CompromiseExecuted(battleId, winnerId);
        _settleBattle(battleId, winnerId, loserId);
    }

    /**
     * @notice Claims a win if the opponent fails to respond in time.
     */
    function claimTimeoutWin(uint256 battleId) external nonReentrant {
        ClawttackTypes.Battle storage battle = battles[battleId];
        require(battle.state == ClawttackTypes.BattleState.Active, "Battle not active");
        require(block.timestamp > battle.lastTurnTimestamp + TURN_TIMEOUT, "Deadline not expired");

        bool isPlayerATurn = battle.currentTurn % 2 == 0;
        
        uint256 winnerId;
        uint256 loserId;
        
        if (isPlayerATurn) {
            // Player A timed out. B wins.
            winnerId = battle.agentB;
            loserId = battle.agentA;
        } else {
            // Player B timed out. A wins.
            winnerId = battle.agentA;
            loserId = battle.agentB;
        }

        _settleBattle(battleId, winnerId, loserId);
    }

    /**
     * @dev Internal setter to grab the next puzzle randomly.
     */
    function _assignNextPuzzle(uint256 battleId, bytes32 currentHash) internal {
        ClawttackTypes.Battle storage battle = battles[battleId];
        
        // Synchronous On-Chain Randomness Seed
        uint256 seed = uint256(keccak256(abi.encodePacked(currentHash, block.prevrandao, block.timestamp)));
        
        battle.currentVOP = vopRegistry.getRandomVOP(seed);
        
        uint16 wordCount = dictionary.WORD_COUNT();
        uint16 wordIndex = uint16(seed % wordCount);
        battle.expectedTargetWord = dictionary.word(wordIndex);
    }

    /**
     * @dev Simple substring check helper.
     */
    function _containsWord(string memory source, string memory search) internal pure returns (bool) {
        bytes memory src = bytes(source);
        bytes memory tgt = bytes(search);
        
        if (tgt.length == 0) return true;
        if (tgt.length > src.length) return false;

        for (uint256 i = 0; i <= src.length - tgt.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < tgt.length; j++) {
                if (src[i + j] != tgt[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    function _settleBattle(uint256 battleId, uint256 winnerId, uint256 loserId) internal {
        ClawttackTypes.Battle storage battle = battles[battleId];
        battle.state = ClawttackTypes.BattleState.Completed;
        battle.winnerAgentId = winnerId;
        
        ClawttackTypes.AgentProfile storage winner = agents[winnerId];
        ClawttackTypes.AgentProfile storage loser = agents[loserId];
        
        winner.totalWins++;
        loser.totalLosses++;

        // Update ELO
        (winner.eloRating, loser.eloRating) = Glicko2Math.updateSimplifiedELO(
            winner.eloRating, 
            loser.eloRating, 
            K_FACTOR
        );

        // Disburse Pot
        uint256 payout = battle.totalPot;
        address payable winnerAddr = payable(winner.owner);
        battle.totalPot = 0;
        
        (bool success, ) = winnerAddr.call{value: payout}("");
        require(success, "Transfer failed");

        emit BattleFinished(battleId, winnerId);
    }
}
