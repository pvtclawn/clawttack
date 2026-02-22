// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Initializable} from "openzeppelin-contracts/contracts/proxy/utils/Initializable.sol";
import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "./libraries/ClawttackErrors.sol";
import {LinguisticParser} from "./libraries/LinguisticParser.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {IVOPRegistry} from "./interfaces/IVOPRegistry.sol";
import {IVerifiableOraclePrimitive} from "./interfaces/IVerifiableOraclePrimitive.sol";
import {IWordDictionary} from "./interfaces/IWordDictionary.sol";
import {IClawttackArenaView} from "./interfaces/IClawttackArenaView.sol";

/**
 * @title ClawttackBattle
 * @notice An isolated EIP-1167 proxy clone managing a single 1v1 battle lifecycle.
 * @dev Enforces the game rules, puzzles, linguistics, and CTF extraction. Holds operational stakes.
 */
contract ClawttackBattle is Initializable {
    using ClawttackTypes for ClawttackTypes.BattleConfig;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    address public arena;

    // Constants
    uint256 public constant MAX_NARRATIVE_LEN = 256;
    uint32 public constant TURNS_UNTIL_HALVING = 5;
    string public constant COMPROMISE_REASON = "COMPROMISE";
    string public constant ETH_SIGNED_MESSAGE_PREFIX = "\x19Ethereum Signed Message:\n32";
    uint256 public constant BPS_DENOMINATOR = 10000;

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
    uint16 public poisonWordIndex;
    bytes public currentVopParams;

    // Events
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
        uint32 turnNumber,
        uint256 indexed playerId,
        bytes32 sequenceHash,
        uint16 targetWord,
        uint16 poisonWord,
        bytes nextVopParams,
        string narrative
    );
    event JokerPlayed(uint256 indexed battleId, uint256 indexed agentId, uint8 jokersRemaining);
    event FlagCaptured(uint256 indexed battleId, uint256 indexed winnerId, uint256 indexed loserId);
    event TimeoutClaimed(uint256 indexed battleId, uint256 indexed claimantId);

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

    /**
     * @notice Accepts an open battle by matching the stake.
     * @dev Rolls the `prevrandao` to deterministically allocate the First Mover advantage.
     * @param _acceptorId The ID of the responding agent.
     */
    function acceptBattle(uint256 _acceptorId) external payable {
        if (state != ClawttackTypes.BattleState.Open) revert ClawttackErrors.BattleNotOpen();
        if (msg.value != config.stake) revert ClawttackErrors.InsufficientValue();
        if (_acceptorId == challengerId) revert ClawttackErrors.CannotBattleSelf();

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

        uint256 r = uint256(keccak256(abi.encodePacked(block.prevrandao, battleId)));
        firstMoverA = (r % 2 == 0);

        startBlock = uint32(block.number + config.warmupBlocks);
        turnDeadlineBlock = startBlock + config.baseTimeoutBlocks;

        currentTurn = 0;
        sequenceHash = keccak256(abi.encodePacked(battleId, _acceptorId, r));

        address vopRegistry = IClawttackArenaView(arena).vopRegistry();
        address wordDictionary = IClawttackArenaView(arena).wordDictionary();

        currentVop = IVOPRegistry(vopRegistry).getRandomVop(r);
        targetWordIndex = uint16(r % IWordDictionary(wordDictionary).wordCount());

        emit BattleAccepted(battleId, _acceptorId, firstMoverA);
    }

    /**
     * @notice Submits the next narrative and puzzle solution for the battle.
     * @dev Validates the VOP gate, linguistic constraints, and updates the sequence hash.
     * @param payload The encoded payload containing narrative, solution, next target logic, etc.
     */
    function submitTurn(ClawttackTypes.TurnPayload calldata payload) external {
        if (state != ClawttackTypes.BattleState.Active) revert ClawttackErrors.BattleNotActive();

        bool isPlayerA = msg.sender == challengerOwner;
        bool isPlayerB = msg.sender == acceptorOwner;
        if (!isPlayerA && !isPlayerB) revert ClawttackErrors.NotParticipant();

        bool expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;
        if (isPlayerA != expectedA) revert ClawttackErrors.UnauthorizedTurn();

        if (block.number > turnDeadlineBlock) revert ClawttackErrors.TurnDeadlineExpired();

        uint256 narrativeLen = bytes(payload.narrative).length;
        if (narrativeLen > MAX_NARRATIVE_LEN) {
            if (narrativeLen > LinguisticParser.MAX_JOKER_NARRATIVE_LEN) revert ClawttackErrors.NarrativeTooLong();

            if (isPlayerA) {
                if (jokersRemainingA == 0) revert ClawttackErrors.NoJokersRemaining();
                jokersRemainingA--;
                emit JokerPlayed(battleId, challengerId, jokersRemainingA);
            } else {
                if (jokersRemainingB == 0) revert ClawttackErrors.NoJokersRemaining();
                jokersRemainingB--;
                emit JokerPlayed(battleId, acceptorId, jokersRemainingB);
            }
        }

        address wordDictionary = IClawttackArenaView(arena).wordDictionary();
        string memory targetWord = IWordDictionary(wordDictionary).word(targetWordIndex);
        string memory poisonWord = currentTurn > 0 ? IWordDictionary(wordDictionary).word(poisonWordIndex) : "";

        LinguisticParser.verifyLinguistics(payload.narrative, targetWord, poisonWord);

        bool puzzlePassed =
            IVerifiableOraclePrimitive(currentVop).verify(currentVopParams, payload.solution, turnDeadlineBlock);

        if (!puzzlePassed) {
            _settleBattle(
                isPlayerA ? acceptorId : challengerId,
                isPlayerA ? challengerId : acceptorId,
                ClawttackTypes.ResultType.INVALID_SOLUTION
            );
            return;
        }

        sequenceHash = keccak256(
            abi.encodePacked(
                sequenceHash, keccak256(bytes(payload.narrative)), payload.solution, keccak256(payload.nextVopParams)
            )
        );

        currentTurn++;

        uint64 nextTimeout = config.baseTimeoutBlocks >> (currentTurn / TURNS_UNTIL_HALVING);
        if (nextTimeout == 0) nextTimeout = 1;

        uint64 baseForNext = uint64(block.number > startBlock ? block.number : startBlock);
        turnDeadlineBlock = baseForNext + nextTimeout;

        uint256 randomness = uint256(keccak256(abi.encodePacked(block.prevrandao, sequenceHash)));

        currentVop = IVOPRegistry(IClawttackArenaView(arena).vopRegistry()).getRandomVop(randomness);
        uint16 _wordCount = IWordDictionary(wordDictionary).wordCount();
        targetWordIndex = uint16(randomness % _wordCount);
        poisonWordIndex = payload.poisonWordIndex;
        
        // Anti-Trap Security: Prevent RNG from dooming the next player
        if (targetWordIndex == poisonWordIndex) {
            targetWordIndex = (targetWordIndex + 1) % _wordCount;
        }

        currentVopParams = payload.nextVopParams;

        emit TurnSubmitted(
            battleId,
            currentTurn,
            isPlayerA ? challengerId : acceptorId,
            sequenceHash,
            targetWordIndex,
            poisonWordIndex,
            currentVopParams,
            payload.narrative
        );

        if (currentTurn == config.maxTurns) {
            _settleBattle(0, 0, ClawttackTypes.ResultType.MAX_TURNS);
        }
    }

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
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(ETH_SIGNED_MESSAGE_PREFIX, messageHash));

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
            if (!success) revert ClawttackErrors.TransferFailed();
        }

        emit BattleCancelled(battleId);
    }

    function _settleBattle(uint256 winnerId, uint256 loserId, ClawttackTypes.ResultType result) internal {
        state = ClawttackTypes.BattleState.Settled;

        IClawttackArenaView(arena).updateRatings(battleId, winnerId, loserId, config.stake);

        if (totalPot > 0) {
            uint256 fee = (totalPot * IClawttackArenaView(arena).protocolFeeRate()) / BPS_DENOMINATOR;
            uint256 payout = totalPot - fee;

            address winnerAddress = (winnerId == challengerId) ? challengerOwner : acceptorOwner;

            if (fee > 0) {
                // H4 fix: fees go to Arena contract, not directly to owner
                (bool s1,) = arena.call{value: fee}("");
                if (!s1) revert ClawttackErrors.TransferFailed();
            }
            if (payout > 0 && winnerId != 0) {
                (bool s2,) = winnerAddress.call{value: payout}("");
                if (!s2) revert ClawttackErrors.TransferFailed();
            } else if (payout > 0 && winnerId == 0) {
                // It's a draw, refund both
                uint256 refund = payout / 2;
                (bool s3,) = challengerOwner.call{value: refund}("");
                (bool s4,) = acceptorOwner.call{value: payout - refund}("");
                if (!s3 || !s4) revert ClawttackErrors.TransferFailed();
            }
        }

        emit BattleSettled(battleId, winnerId, loserId, result);
    }

    receive() external payable {}
}
