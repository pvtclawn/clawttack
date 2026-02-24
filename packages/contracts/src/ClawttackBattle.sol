// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Initializable} from "openzeppelin-contracts/contracts/proxy/utils/Initializable.sol";
import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "./libraries/ClawttackErrors.sol";
import {LinguisticParser} from "./libraries/LinguisticParser.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {IVerifiableOraclePrimitive} from "./interfaces/IVerifiableOraclePrimitive.sol";
import {IWordDictionary} from "./interfaces/IWordDictionary.sol";
import {IClawttackArenaView} from "./interfaces/IClawttackArenaView.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title ClawttackBattle
 * @notice An isolated EIP-1167 proxy clone managing a single 1v1 battle lifecycle.
 * @dev Enforces the game rules, puzzles, linguistics, and CTF extraction. Holds operational stakes.
 */
contract ClawttackBattle is Initializable {
    using ClawttackTypes for ClawttackTypes.BattleConfig;

    // ─── Constants ───────────────────────────────────────────────────────────

    string public constant DOMAIN_TYPE_INIT = "CLAWTTACK_V3_INIT";
    string public constant DOMAIN_TYPE_TURN = "CLAWTTACK_V3_TURN";
    string public constant COMPROMISE_REASON = "COMPROMISE";

    uint256 public constant MAX_NARRATIVE_LEN = 256;
    uint256 public constant JOKER_NARRATIVE_LEN = 1024;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint32 public constant TURNS_UNTIL_HALVING = 5;
    uint64 public constant MIN_TIMEOUT_FLOOR = 10; // Minimum 10 blocks (~20s on Base) regardless of halving

    // ─── Storage ─────────────────────────────────────────────────────────────

    address public arena;

    uint256 public battleId;
    uint256 public challengerId;
    address public challengerOwner;
    uint8 public jokersRemainingA;

    uint256 public acceptorId;
    address public acceptorOwner;
    uint8 public jokersRemainingB;

    ClawttackTypes.BattleConfig public config;
    ClawttackTypes.BattleState public state;

    uint256 public totalPot;
    bytes32 public sequenceHash;

    address public currentVop;
    uint32 public currentTurn;
    uint64 public turnDeadlineBlock;
    uint32 public startBlock;
    bool public firstMoverA;

    uint16 public targetWordIndex;
    string public poisonWord;
    bytes public currentVopParams;

    // ─── Events ──────────────────────────────────────────────────────────────

    event BattleAccepted(uint256 indexed battleId, uint256 indexed acceptorId, bool challengerGoesFirst);
    event BattleCancelled(uint256 indexed battleId);
    event BattleSettled(
        uint256 indexed battleId,
        uint256 indexed winnerId,
        uint256 indexed loserId,
        ClawttackTypes.ResultType resultType
    );
    event TurnSubmitted(
        uint256 indexed battleId,
        uint256 indexed playerId,
        uint32 turnNumber,
        bytes32 sequenceHash,
        uint16 targetWord,
        string poisonWord,
        bytes nextVopParams,
        string narrative
    );
    event JokerPlayed(uint256 indexed battleId, uint256 indexed agentId, uint8 jokersRemaining);
    event FlagCaptured(uint256 indexed battleId, uint256 indexed winnerId, uint256 indexed loserId);
    event TimeoutClaimed(uint256 indexed battleId, uint256 indexed claimantId);

    /**
     * @notice Locks the implementation contract from being initialized.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the battle clone parameters post-deployment.
     * @dev Called exclusively by the ClawttackArena factory upon creation.
     */
    function initialize(
        address _arena,
        uint256 _battleId,
        uint256 _challengerId,
        address _challengerOwner,
        ClawttackTypes.BattleConfig calldata _config
    ) external initializer {
        arena = _arena;
        battleId = _battleId;
        challengerId = _challengerId;
        challengerOwner = _challengerOwner;
        config = _config;

        state = ClawttackTypes.BattleState.Open;
        jokersRemainingA = _config.maxJokers;
        totalPot = _config.stake;
    }

    receive() external payable {}

    /**
     * @notice Accepts an open battle by matching the stake.
     * @dev Rolls the `prevrandao` to deterministically allocate the First Mover advantage.
     * @param _acceptorId The ID of the responding agent.
     */
    function acceptBattle(uint256 _acceptorId) external payable {
        if (state != ClawttackTypes.BattleState.Open) revert ClawttackErrors.BattleNotOpen();
        if (msg.value != config.stake) revert ClawttackErrors.InsufficientValue();
        if (_acceptorId == challengerId) revert ClawttackErrors.CannotBattleSelf();

        (address _agentOwner, , ,) = IClawttackArenaView(arena).agents(_acceptorId);
        if (_agentOwner != msg.sender) revert ClawttackErrors.NotParticipant();

        if (config.targetAgentId != 0) {
            if (_acceptorId != config.targetAgentId) revert ClawttackErrors.WrongTargetAgent();
        }

        if (config.stake >= IClawttackArenaView(arena).MIN_RATED_STAKE()) {
            (, uint32 cRating,,) = IClawttackArenaView(arena).agents(challengerId);
            (, uint32 aRating,,) = IClawttackArenaView(arena).agents(_acceptorId);
            
            uint32 diff = cRating >= aRating ? cRating - aRating : aRating - cRating;
            if (diff > IClawttackArenaView(arena).MAX_ELO_DIFF()) revert ClawttackErrors.EloDifferenceTooHigh();
        }

        acceptorId = _acceptorId;
        acceptorOwner = msg.sender;
        jokersRemainingB = config.maxJokers;
        totalPot += msg.value;

        state = ClawttackTypes.BattleState.Active;

        uint256 r = uint256(keccak256(abi.encodePacked(DOMAIN_TYPE_INIT, block.prevrandao, battleId)));
        firstMoverA = (r % 2 == 0);

        startBlock = uint32(block.number + config.warmupBlocks);
        turnDeadlineBlock = startBlock + config.baseTimeoutBlocks;

        currentTurn = 0;
        sequenceHash = keccak256(abi.encodePacked(DOMAIN_TYPE_INIT, battleId, _acceptorId, r));

        address wordDictionary = IClawttackArenaView(arena).wordDictionary();

        currentVop = IClawttackArenaView(arena).getRandomVop(r);
        targetWordIndex = uint16(r % IWordDictionary(wordDictionary).wordCount());

        emit BattleAccepted(battleId, _acceptorId, firstMoverA);
    }

    /**
     * @notice Submits the next narrative and puzzle solution for the battle.
     * @dev Validates the VOP gate, linguistic constraints, and updates the sequence hash.
     * @param payload The encoded payload containing narrative segments, solution, next target logic, etc.
     */
    function submitTurn(ClawttackTypes.TurnPayload calldata payload) external {
        if (state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();

        bool isPlayerA = msg.sender == challengerOwner;
        bool isPlayerB = msg.sender == acceptorOwner;
        if (!isPlayerA && !isPlayerB) revert ClawttackErrors.NotParticipant();

        bool expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;
        if (isPlayerA != expectedA) revert ClawttackErrors.UnauthorizedTurn();

        if (block.number > turnDeadlineBlock) revert ClawttackErrors.TurnDeadlineExpired();

        // 1. Joker / narrative-length enforcement
        uint256 narrativeLen = bytes(payload.narrative).length;
        bool isJoker = narrativeLen > MAX_NARRATIVE_LEN;
        if (isJoker) {
            if (narrativeLen > JOKER_NARRATIVE_LEN) revert ClawttackErrors.NarrativeTooLong();
            uint8 jokersLeft = isPlayerA ? jokersRemainingA : jokersRemainingB;
            if (jokersLeft == 0) revert ClawttackErrors.NoJokersRemaining();
            if (isPlayerA) { jokersRemainingA--; } else { jokersRemainingB--; }
            emit JokerPlayed(battleId, isPlayerA ? challengerId : acceptorId, isPlayerA ? jokersRemainingA : jokersRemainingB);
        }

        // 2. Linguistic verification
        address wordDictionary = IClawttackArenaView(arena).wordDictionary();
        string memory targetWord = IWordDictionary(wordDictionary).word(targetWordIndex);
        string memory _currentPoison = currentTurn > 0 ? poisonWord : "";

        LinguisticParser.verifyLinguistics(payload.narrative, targetWord, _currentPoison);

        // Validate custom poison word
        uint256 poisonLen = bytes(payload.customPoisonWord).length;
        if (poisonLen < 3 || poisonLen > 32) revert ClawttackErrors.InvalidPoisonWord();
        for (uint256 i = 0; i < poisonLen; i++) {
            if (uint8(bytes(payload.customPoisonWord)[i]) > LinguisticParser.MAX_ASCII_VALUE) revert ClawttackErrors.InvalidPoisonWord();
        }

        // 3. VOP puzzle verification
        bool puzzlePassed;
        if (currentVopParams.length == 0) {
            puzzlePassed = true; // Turn 0 has no required VOP solution
        } else {
            try IVerifiableOraclePrimitive(currentVop).verify(currentVopParams, payload.solution, turnDeadlineBlock) returns (bool _passed) {
                puzzlePassed = _passed;
            } catch {
                puzzlePassed = false; // Reverts mean the puzzle was not solved
            }
        }

        if (!puzzlePassed) {
            _settleBattle(
                isPlayerA ? acceptorId : challengerId,
                isPlayerA ? challengerId : acceptorId,
                ClawttackTypes.ResultType.INVALID_SOLUTION
            );
            return;
        }

        // 4. Advance sequence hash (chains narrative + solution)
        sequenceHash = keccak256(
            abi.encodePacked(
                DOMAIN_TYPE_TURN, sequenceHash, keccak256(bytes(payload.narrative)), payload.solution
            )
        );

        currentTurn++;

        uint64 nextTimeout = config.baseTimeoutBlocks >> (currentTurn / TURNS_UNTIL_HALVING);
        if (nextTimeout < MIN_TIMEOUT_FLOOR) nextTimeout = MIN_TIMEOUT_FLOOR;

        uint64 baseForNext = uint64(block.number > startBlock ? block.number : startBlock);
        turnDeadlineBlock = baseForNext + nextTimeout;

        uint256 randomness = uint256(keccak256(abi.encodePacked(DOMAIN_TYPE_TURN, block.prevrandao, sequenceHash)));

        currentVop = IClawttackArenaView(arena).getRandomVop(randomness);
        uint16 _wordCount = IWordDictionary(wordDictionary).wordCount();
        targetWordIndex = uint16(randomness % _wordCount);
        
        string memory nextTargetWord = IWordDictionary(wordDictionary).word(targetWordIndex);

        // Anti-Trap Security: Prevent impossible constraints
        if (LinguisticParser.containsSubstring(nextTargetWord, payload.customPoisonWord) || 
            LinguisticParser.containsSubstring(payload.customPoisonWord, nextTargetWord)) {
            revert ClawttackErrors.InvalidPoisonWord();
        }

        poisonWord = payload.customPoisonWord;

        currentVopParams = IVerifiableOraclePrimitive(currentVop).generateParams(randomness);

        emit TurnSubmitted(
            battleId,
            isPlayerA ? challengerId : acceptorId,
            currentTurn,
            sequenceHash,
            targetWordIndex,
            poisonWord,
            currentVopParams,
            payload.narrative
        );

        if (currentTurn == config.maxTurns) {
            _settleBattle(0, 0, ClawttackTypes.ResultType.MAX_TURNS);
        }
    }


    /**
     * @notice Claims victory if the active opponent has missed their `turnDeadlineBlock`.
     */
    function claimTimeoutWin() external {
        if (state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();
        if (block.number <= turnDeadlineBlock) revert ClawttackErrors.DeadlineNotExpired();

        bool expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;

        uint256 winnerId = expectedA ? acceptorId : challengerId;
        uint256 loserId = expectedA ? challengerId : acceptorId;

        emit TimeoutClaimed(battleId, winnerId);
        _settleBattle(winnerId, loserId, ClawttackTypes.ResultType.TIMEOUT);
    }

    /**
     * @notice Submits a captured ECDSA signature corresponding to the opponent.
     * @dev The ultimate CTF win condition. Triggers immediate compromise resolution.
     * @param signature The bytes of the signature signed by the victim's EOA owner.
     */
    function submitCompromise(bytes calldata signature) external {
        if (state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();

        bool isPlayerA = msg.sender == challengerOwner;
        bool isPlayerB = msg.sender == acceptorOwner;
        if (!isPlayerA && !isPlayerB) revert ClawttackErrors.NotParticipant();

        address targetVictim = isPlayerA ? acceptorOwner : challengerOwner;
        uint256 victimId = isPlayerA ? acceptorId : challengerId;
        uint256 attackerId = isPlayerA ? challengerId : acceptorId;

        bytes32 messageHash = keccak256(abi.encode(block.chainid, address(this), battleId, COMPROMISE_REASON));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);

        address recovered = ECDSA.recover(ethSignedMessageHash, signature);

        if (recovered != targetVictim) revert ClawttackErrors.InvalidCompromiseSignature();

        emit FlagCaptured(battleId, attackerId, victimId);
        _settleBattle(attackerId, victimId, ClawttackTypes.ResultType.COMPROMISE);
    }

    /**
     * @notice Cancels an unaccepted battle, refunding the challenger's stake.
     */
    function cancelBattle() external {
        if (state != ClawttackTypes.BattleState.Open) revert ClawttackErrors.BattleNotCancellable();
        if (msg.sender != challengerOwner) revert ClawttackErrors.UnauthorizedTurn();

        state = ClawttackTypes.BattleState.Cancelled;

        if (totalPot > 0) {
            (bool success,) = challengerOwner.call{value: totalPot}("");
            // Do not revert on failure to prevent permanent un-cancellable state
        }

        emit BattleCancelled(battleId);
    }

    // ─── External View ───────────────────────────────────────────────────────

    /**
     * @notice A public utility view for agents to dry-run linguistic checks off-chain.
     * @return passesTarget True if boundary logic passes.
     * @return passesPoison True if the substring blacklist logic passes.
     * @return passesLength True if within length bounds.
     * @return passesAscii True if characters are strictly ASCII (< 128).
     */
    function wouldNarrativePass(
        string calldata narrative,
        uint16 _targetWordIndex,
        uint16 _poisonWordIndex,
        bool isTurnZero
    ) external view returns (bool passesTarget, bool passesPoison, bool passesLength, bool passesAscii) {
        address wordDictionary = IClawttackArenaView(arena).wordDictionary();
        string memory tWord = IWordDictionary(wordDictionary).word(_targetWordIndex);
        string memory pWord = isTurnZero ? "" : IWordDictionary(wordDictionary).word(_poisonWordIndex);

        return LinguisticParser.wouldPass(narrative, tWord, pWord);
    }

    /**
     * @notice Returns the full battle state in a single call.
     * @dev Challenge #82: Ensures atomic read consistency.
     */
    function getBattleState() external view returns (
        ClawttackTypes.BattleState _state,
        uint32 _currentTurn,
        uint64 _turnDeadlineBlock,
        bytes32 _sequenceHash,
        uint256 _battleId,
        bool _firstMoverA
    ) {
        return (state, currentTurn, turnDeadlineBlock, sequenceHash, battleId, firstMoverA);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _settleBattle(uint256 winnerId, uint256 loserId, ClawttackTypes.ResultType result) internal {
        state = ClawttackTypes.BattleState.Settled;

        IClawttackArenaView(arena).updateRatings(battleId, challengerId, acceptorId, winnerId, loserId, config.stake);

        if (totalPot > 0) {
            uint256 fee = (totalPot * IClawttackArenaView(arena).protocolFeeRate()) / BPS_DENOMINATOR;
            uint256 payout = totalPot - fee;

            address winnerAddress = (winnerId == challengerId) ? challengerOwner : acceptorOwner;

            if (fee > 0) {
                (bool s1,) = arena.call{value: fee}("");
                if (!s1) {
                    payout += fee;
                }
            }
            if (payout > 0 && winnerId != 0) {
                (bool s2,) = winnerAddress.call{value: payout}("");
                // Do not revert on failure; state must successfully settle
            } else if (payout > 0 && winnerId == 0) {
                // It's a draw, refund both
                uint256 refund = payout / 2;
                (bool s3,) = challengerOwner.call{value: refund}("");
                (bool s4,) = acceptorOwner.call{value: payout - refund}("");
                // Do not revert on failure
            }
        }

        emit BattleSettled(battleId, winnerId, loserId, result);
    }

    /**
     * @notice Rescues ETH stuck in a settled battle (e.g., failed transfer to contract wallet).
     * @dev Only callable by the arena owner. Only works after settlement to prevent abuse.
     * @param to The address to send the stuck funds to.
     */
    function rescueStuckFunds(address payable to) external {
        if (state != ClawttackTypes.BattleState.Settled) revert ClawttackErrors.BattleNotActive();
        if (msg.sender != Ownable(arena).owner()) revert ClawttackErrors.NotParticipant();
        uint256 balance = address(this).balance;
        if (balance == 0) revert ClawttackErrors.InsufficientValue();
        (bool success,) = to.call{value: balance}("");
        if (!success) revert ClawttackErrors.TransferFailed();
    }
}

