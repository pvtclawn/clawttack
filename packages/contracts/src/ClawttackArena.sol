// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {Glicko2Math} from "./libraries/Glicko2Math.sol";
import {IVerifiableOraclePrimitive} from "./interfaces/IVerifiableOraclePrimitive.sol";
import {VOPRegistry} from "./VOPRegistry.sol";
import {BIP39Words} from "./BIP39Words.sol";
import {ClawttackErrors} from "./libraries/ClawttackErrors.sol";

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
    uint256 public constant MAX_NARRATIVE_LENGTH = 280;
    uint256 public constant MAX_FEE_RATE = 1000; // 10% maximum fee

    uint256 public nextBattleId = 1;
    
    address public owner;
    address public feeRecipient;
    uint256 public feeRate; // measured in basis points (100 = 1%)

    mapping(uint256 => ClawttackTypes.AgentProfile) public agents;
    mapping(uint256 => ClawttackTypes.Battle) public battles;
    
    // Anti-frontrunning
    mapping(bytes32 => bool) public usedTurnHashes;

    event AgentRegistered(uint256 indexed agentId, address owner, address vaultKey);
    event BattleCreated(uint256 indexed battleId, uint256 agentA, uint256 stake);
    event BattleAccepted(uint256 indexed battleId, uint256 agentB);
    event TurnSubmitted(
        uint256 indexed battleId, 
        uint32 turnNumber, 
        address player, 
        bytes32 sequenceHash,
        uint16 expectedTargetWordIndex,
        string narrative,
        uint16 poisonWordIndex,
        bytes nextVOPParams
    );
    event CompromiseExecuted(uint256 indexed battleId, uint256 winnerAgentId);
    event BattleFinished(uint256 indexed battleId, uint256 winnerAgentId);
    event BattleCancelled(uint256 indexed battleId);

    constructor(address _vopRegistry, address _dictionary) {
        vopRegistry = VOPRegistry(_vopRegistry);
        dictionary = BIP39Words(_dictionary);
        owner = msg.sender;
        feeRecipient = msg.sender;
        feeRate = 0;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert ClawttackErrors.OnlyOwner();
        _;
    }

    /**
     * @notice Register a new Agent Profile with its vault key for CTF mode.
     */
    function registerAgent(uint256 agentId, address vaultKey) external {
        if(agents[agentId].owner != address(0)) revert ClawttackErrors.AgentAlreadyExists();
        if(vaultKey == address(0)) revert ClawttackErrors.InvalidVaultKey();

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

    // --- ADMIN SETTINGS ---

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function setFeeRate(uint256 newRate) external onlyOwner {
        if (newRate > MAX_FEE_RATE) revert ClawttackErrors.FeeTooHigh();
        feeRate = newRate;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    // --- GAME ENGINE ---

    /**
     * @notice Initiates a new battle.
     */
    function createBattle(uint256 agentId) external payable returns (uint256) {
        if(agents[agentId].owner != msg.sender) revert ClawttackErrors.NotAgentOwner();
        if(msg.value < MIN_STAKE) revert ClawttackErrors.StakeTooLow();

        uint256 battleId = nextBattleId++;
        
        battles[battleId] = ClawttackTypes.Battle({
            battleId: battleId,
            stakePerAgent: msg.value,
            totalPot: msg.value,
            sequenceHash: keccak256(abi.encodePacked(battleId, agentId)),
            
            ownerA: msg.sender,
            agentA: uint64(agentId),
            state: ClawttackTypes.BattleState.Open,
            
            ownerB: address(0),
            agentB: 0,
            
            currentVOP: address(0),
            currentTurn: 0,
            lastTurnTimestamp: 0,
            
            winnerAgentId: 0,
            expectedTargetWordIndex: 0,
            lastPoisonWordIndex: 0,
            
            currentVOPParams: ""
        });

        emit BattleCreated(battleId, agentId, msg.value);
        return battleId;
    }

    /**
     * @notice Cancels an open battle and refunds the stake to the creator.
     */
    function cancelBattle(uint256 battleId) external nonReentrant {
        ClawttackTypes.Battle storage battle = battles[battleId];
        if (battle.state != ClawttackTypes.BattleState.Open) revert ClawttackErrors.BattleNotCancellable();
        if (battle.ownerA != msg.sender) revert ClawttackErrors.UnauthorizedTurn(); // Reusing unauthorized turn or we can add new error. UnauthorizedTurn is fine.
        
        battle.state = ClawttackTypes.BattleState.Cancelled;
        
        uint256 refundAmount = battle.stakePerAgent;
        battle.stakePerAgent = 0;
        battle.totalPot = 0;
        
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert ClawttackErrors.TransferFailed();

        emit BattleCancelled(battleId);
    }

    /**
     * @notice Opponent accepts an open battle, checking ELO matchmaking constraints.
     */
    function acceptBattle(uint256 battleId, uint256 agentB) external payable {
        ClawttackTypes.Battle storage battle = battles[battleId];
        if(battle.state != ClawttackTypes.BattleState.Open) revert ClawttackErrors.BattleNotOpen();
        if(agents[agentB].owner != msg.sender) revert ClawttackErrors.NotAgentOwner();
        if(msg.value != battle.stakePerAgent) revert ClawttackErrors.StakeMismatch();
        if(battle.agentA == agentB) revert ClawttackErrors.CannotBattleSelf();

        // Enforce Glicko-2 Matchmaking Constraints
        bool isMatchable = Glicko2Math.isMatchable(
            agents[battle.agentA].eloRating,
            agents[battle.agentA].eloRD,
            agents[agentB].eloRating,
            agents[agentB].eloRD
        );
        if(!isMatchable) revert ClawttackErrors.EloRatingMismatch();

        battle.agentB = uint64(agentB);
        battle.ownerB = msg.sender;
        battle.totalPot += msg.value;
        battle.state = ClawttackTypes.BattleState.Active;
        battle.lastTurnTimestamp = uint64(block.timestamp);
        
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

        if(battle.state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();
        if(bytes(payload.narrative).length > MAX_NARRATIVE_LENGTH) revert ClawttackErrors.NarrativeTooLong();

        // Verify whose turn it is
        bool isPlayerA = battle.currentTurn % 2 == 0;
        address expectedSigner = isPlayerA ? battle.ownerA : battle.ownerB;
        if(msg.sender != expectedSigner) revert ClawttackErrors.UnauthorizedTurn();
        
        // Check timeout
        if(block.timestamp > battle.lastTurnTimestamp + TURN_TIMEOUT) revert ClawttackErrors.TurnDeadlineExpired();

        // 1. Reconstruct Turn Hash to verify signature
        bytes32 turnHash = keccak256(abi.encode(
            block.chainid,
            address(this),
            battle.sequenceHash,
            payload.battleId,
            payload.solution,
            keccak256(bytes(payload.narrative)),
            keccak256(payload.nextVOPParams),
            payload.poisonWordIndex
        ));

        if(usedTurnHashes[turnHash]) revert ClawttackErrors.TurnHashUsed();
        usedTurnHashes[turnHash] = true;

        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(turnHash);
        if(messageHash.recover(signature) != expectedSigner) revert ClawttackErrors.InvalidSignature();

        // 2. Validate Target Word (Linguistic Entrapment)
        string memory targetWord = dictionary.word(battle.expectedTargetWordIndex);
        if(!_containsWord(payload.narrative, targetWord)) revert ClawttackErrors.TargetWordMissing();

        // 3. Validate Poison Word evasion
        if (battle.currentTurn > 0) {
            string memory poisonWord = dictionary.word(battle.lastPoisonWordIndex);
            if(_containsWord(payload.narrative, poisonWord)) revert ClawttackErrors.PoisonWordDetected();
        }

        // 4. Validate VOP Gate Solution using historical anchoring
        if (battle.currentVOP != address(0) && battle.currentVOPParams.length > 0) {
            bool valid = IVerifiableOraclePrimitive(battle.currentVOP).verify(
                battle.currentVOPParams,
                payload.solution,
                block.number - 1 // Grounded frozen anchoring
            );
            if(!valid) revert ClawttackErrors.VOPPuzzleFailed();
        }

        // UPDATE STATE
        battle.lastPoisonWordIndex = payload.poisonWordIndex;
        
        // Advance Sequence Hash
        battle.sequenceHash = keccak256(abi.encodePacked(
            battle.sequenceHash,
            turnHash,
            block.timestamp
        ));

        uint16 previousTargetWordIndex = battle.expectedTargetWordIndex;
        
        // Generate the Next Puzzle for the Opponent
        _assignNextPuzzle(battleId, battle.sequenceHash);
        battle.currentVOPParams = payload.nextVOPParams; // Difficulty configured by current player

        battle.currentTurn++;
        battle.lastTurnTimestamp = uint64(block.timestamp);

        emit TurnSubmitted(
            battleId, 
            battle.currentTurn, 
            expectedSigner, 
            battle.sequenceHash,
            previousTargetWordIndex,
            payload.narrative,
            payload.poisonWordIndex,
            payload.nextVOPParams
        );
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
        if(battle.state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();
        
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
            revert ClawttackErrors.NotParticipant();
        }

        // Verify the signature is actually from the victim's vault key
        bytes32 protectedHash = keccak256(abi.encode(
            block.chainid,
            address(this),
            battleId,
            keccak256(compromiseMessage)
        ));
        
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(protectedHash);
        if(messageHash.recover(signature) != targetVault) revert ClawttackErrors.InvalidCompromiseSignature();

        emit CompromiseExecuted(battleId, winnerId);
        _settleBattle(battleId, winnerId, loserId);
    }

    /**
     * @notice Claims a win if the opponent fails to respond in time.
     */
    function claimTimeoutWin(uint256 battleId) external nonReentrant {
        ClawttackTypes.Battle storage battle = battles[battleId];
        if(battle.state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();
        if(block.timestamp <= battle.lastTurnTimestamp + TURN_TIMEOUT) revert ClawttackErrors.DeadlineNotExpired();

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
        
        uint16 totalWords = dictionary.wordCount();
        uint16 wordIndex = uint16(seed % totalWords);
        battle.expectedTargetWordIndex = wordIndex;
    }

    function _toLower(bytes1 b) internal pure returns (bytes1) {
        if (b >= 0x41 && b <= 0x5A) {
            return bytes1(uint8(b) + 32);
        }
        return b;
    }

    function _isLetter(bytes1 b) internal pure returns (bool) {
        return (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A);
    }

    /**
     * @dev Linguistically enforces exact word boundary matching and case-insensitivity. 
     */
    function _containsWord(string memory source, string memory search) internal pure returns (bool) {
        bytes memory src = bytes(source);
        bytes memory tgt = bytes(search);
        
        uint256 srcLen = src.length;
        uint256 tgtLen = tgt.length;
        
        if (tgtLen == 0) return true;
        if (tgtLen > srcLen) return false;

        for (uint256 i = 0; i <= srcLen - tgtLen; i++) {
            bool isMatch = true;
            for (uint256 j = 0; j < tgtLen; j++) {
                if (_toLower(src[i + j]) != _toLower(tgt[j])) {
                    isMatch = false;
                    break;
                }
            }

            if (isMatch) {
                // Check word boundaries
                bool leftBoundaryOk = (i == 0) || !_isLetter(src[i - 1]);
                bool rightBoundaryOk = (i + tgtLen == srcLen) || !_isLetter(src[i + tgtLen]);
                
                if (leftBoundaryOk && rightBoundaryOk) {
                    return true;
                }
            }
        }
        return false;
    }

    function _settleBattle(uint256 battleId, uint256 winnerId, uint256 loserId) internal {
        ClawttackTypes.Battle storage battle = battles[battleId];
        battle.state = ClawttackTypes.BattleState.Completed;
        battle.winnerAgentId = uint64(winnerId);
        
        ClawttackTypes.AgentProfile storage winner = agents[winnerId];
        ClawttackTypes.AgentProfile storage loser = agents[loserId];
        
        winner.totalWins++;
        loser.totalLosses++;

        // Update ELO
        (winner.eloRating, loser.eloRating) = Glicko2Math.updateSimplifiedELO(
            winner.eloRating, 
            loser.eloRating, 
            uint32(K_FACTOR)
        );

        // Disburse Pot
        uint256 amountToWinner = battle.totalPot;
        if (feeRate > 0 && feeRecipient != address(0)) {
            uint256 fee = (amountToWinner * feeRate) / 10000;
            amountToWinner -= fee;
            (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
            if (!feeSuccess) revert ClawttackErrors.TransferFailed();
        }

        address payable winnerAddr = payable(winner.owner);
        battle.totalPot = 0;
        
        (bool success, ) = winnerAddr.call{value: amountToWinner}("");
        if(!success) revert ClawttackErrors.TransferFailed();

        emit BattleFinished(battleId, winnerId);
    }

    // --- VIEW GETTERS ---

    /**
     * @notice Returns the address of the player whose turn it currently is.
     */
    function whoseTurn(uint256 battleId) external view returns (address) {
        ClawttackTypes.Battle storage battle = battles[battleId];
        if (battle.state != ClawttackTypes.BattleState.Active) return address(0);
        return (battle.currentTurn % 2 == 0) ? battle.ownerA : battle.ownerB;
    }

    /**
     * @notice Returns the time remaining in seconds for the current turn.
     */
    function timeRemaining(uint256 battleId) external view returns (uint256) {
        ClawttackTypes.Battle storage battle = battles[battleId];
        if (battle.state != ClawttackTypes.BattleState.Active) return 0;
        uint256 deadline = battle.lastTurnTimestamp + TURN_TIMEOUT;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    /**
     * @notice Fetch the full Battle struct including dynamic fields (string, bytes).
     * @dev Solidity auto-getters for mappings drop dynamic arrays; this exposes the full struct.
     */
    function getBattle(uint256 battleId) external view returns (ClawttackTypes.Battle memory) {
        return battles[battleId];
    }
}
