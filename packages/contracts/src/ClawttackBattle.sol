// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Initializable} from "openzeppelin-contracts/contracts/proxy/utils/Initializable.sol";
import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "./libraries/ClawttackErrors.sol";
import {ChessClockLib} from "./libraries/ChessClockLib.sol";
import {NccVerifier} from "./libraries/NccVerifier.sol";
import {FastSubstring} from "./libraries/FastSubstring.sol";
import {ClozeVerifier} from "./ClozeVerifier.sol";
import {LinguisticParser} from "./libraries/LinguisticParser.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {IVerifiableOraclePrimitive} from "./interfaces/IVerifiableOraclePrimitive.sol";
import {IWordDictionary} from "./interfaces/IWordDictionary.sol";
import {IClawttackArenaView} from "./interfaces/IClawttackArenaView.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title ClawttackBattle
 * @notice v0 battle contract with chess clock timing + NCC offset-verified commit-reveal.
 * @dev Key changes from v3:
 *      - Timer decay replaced with chess clock (ChessClockLib)
 *      - NCC: 4-candidate VCPSC with offset verification (NccVerifier)
 *      - No maxTurns — bank decay guarantees termination
 *      - ResultType.BANK_EMPTY added
 *      - Simulation-verified: 960K battles, 100% LLM vs script win rate
 */
contract ClawttackBattle is Initializable {
    using ChessClockLib for ChessClockLib.Clock;

    // ─── Constants ──────────────────────────────────────────────────────────
    string public constant DOMAIN_TYPE_INIT = "CLAWTTACK_INIT";
    string public constant DOMAIN_TYPE_TURN = "CLAWTTACK_TURN";
    string public constant COMPROMISE_REASON = "COMPROMISE";

    uint256 public constant MAX_NARRATIVE_LEN = 256;
    uint256 public constant JOKER_NARRATIVE_LEN = 1024;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── Storage ────────────────────────────────────────────────────────────
    address public arena;

    uint256 public battleId;
    uint256 public challengerId;
    address public challengerOwner;
    uint8 public jokersRemainingA;

    uint256 public acceptorId;
    address public acceptorOwner;
    uint8 public jokersRemainingB;

    ClawttackTypes.BattleConfig public config;
    ClawttackTypes.ResultType public state; // reusing ResultType.None as "Open"

    uint256 public totalPot;
    bytes32 public sequenceHash;

    address public currentVop;
    uint32 public currentTurn;
    uint32 public startBlock;
    bool public firstMoverA;

    uint16 public targetWordIndex;
    string public poisonWord;
    bytes public currentVopParams;

    bytes32 internal secretHashA;
    bytes32 internal secretHashB;

    // Chess clock
    ChessClockLib.Clock public clock;

    // NCC results (set when opponent reveals, used on own clock tick)
    // True = this agent correctly answered opponent's NCC
    bool public nccResultA;  // A's defense result (set when B reveals)
    bool public nccResultB;  // B's defense result (set when A reveals)
    bool public nccResultAReady;  // Has A's result been set?
    bool public nccResultBReady;  // Has B's result been set?

    // NCC pending state (commitment + defense tracking)
    ClawttackTypes.PendingNcc public pendingNccA; // NCC attack set by A, pending B's defense
    ClawttackTypes.PendingNcc public pendingNccB; // NCC attack set by B, pending A's defense

    // Battle lifecycle: Open(0) → Active(1) → Settled(2) | Cancelled(3)
    enum BattlePhase { Open, Active, Settled, Cancelled }
    BattlePhase public phase;

    // ─── Events ─────────────────────────────────────────────────────────────
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
        string narrative,
        uint128 bankA,
        uint128 bankB
    );
    event JokerPlayed(uint256 indexed battleId, uint256 indexed agentId, uint8 jokersRemaining);
    event FlagCaptured(uint256 indexed battleId, uint256 indexed winnerId, uint256 indexed loserId);
    event TimeoutClaimed(uint256 indexed battleId, uint256 indexed claimantId);
    event NccResolved(uint256 indexed battleId, uint32 turn, bool defenderCorrect, uint128 newBank);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _arena,
        uint256 _battleId,
        uint256 _challengerId,
        address _challengerOwner,
        ClawttackTypes.BattleConfig calldata _config,
        bytes32 _secretHash
    ) external initializer {
        arena = _arena;
        battleId = _battleId;
        challengerId = _challengerId;
        challengerOwner = _challengerOwner;
        config = _config;
        phase = BattlePhase.Open;
        jokersRemainingA = _config.maxJokers;
        totalPot = _config.stake;
        secretHashA = _secretHash;
    }

    receive() external payable {}

    // ─── Accept ─────────────────────────────────────────────────────────────

    function acceptBattle(uint256 _acceptorId, bytes32 _secretHash) external payable {
        if (phase != BattlePhase.Open) revert ClawttackErrors.BattleNotOpen();
        if (msg.value != config.stake) revert ClawttackErrors.InsufficientValue();
        if (_acceptorId == challengerId) revert ClawttackErrors.CannotBattleSelf();

        (address _agentOwner,,,) = IClawttackArenaView(arena).agents(_acceptorId);
        if (_agentOwner != msg.sender) revert ClawttackErrors.NotParticipant();

        if (config.targetAgentId != 0) {
            if (_acceptorId != config.targetAgentId) revert ClawttackErrors.WrongTargetAgent();
        }

        acceptorId = _acceptorId;
        acceptorOwner = msg.sender;
        jokersRemainingB = config.maxJokers;
        totalPot += msg.value;
        secretHashB = _secretHash;

        // Elo rating check for rated battles
        if (config.stake >= IClawttackArenaView(arena).MIN_RATED_STAKE()) {
            (, uint32 cRating,,) = IClawttackArenaView(arena).agents(challengerId);
            (, uint32 aRating,,) = IClawttackArenaView(arena).agents(_acceptorId);
            uint32 diff = cRating >= aRating ? cRating - aRating : aRating - cRating;
            if (diff > IClawttackArenaView(arena).MAX_ELO_DIFF()) revert ClawttackErrors.EloDifferenceTooHigh();
        }

        phase = BattlePhase.Active;

        uint256 r = uint256(keccak256(abi.encodePacked(DOMAIN_TYPE_INIT, block.prevrandao, battleId)));
        firstMoverA = (r % 2 == 0);

        startBlock = uint32(block.number + config.warmupBlocks);

        // Initialize chess clock
        clock.init();

        currentTurn = 0;
        sequenceHash = keccak256(abi.encodePacked(DOMAIN_TYPE_INIT, battleId, _acceptorId, r));

        address wordDictionary = IClawttackArenaView(arena).wordDictionary();
        currentVop = IClawttackArenaView(arena).getRandomVop(r);
        targetWordIndex = uint16(r % IWordDictionary(wordDictionary).wordCount());

        emit BattleAccepted(battleId, _acceptorId, firstMoverA);
    }

    // ─── Submit Turn ────────────────────────────────────────────────────────

    function submitTurn(ClawttackTypes.TurnPayload calldata payload) external {
        if (phase != BattlePhase.Active) revert ClawttackErrors.BattleNotActive();

        bool isPlayerA = msg.sender == challengerOwner;
        bool isPlayerB = msg.sender == acceptorOwner;
        if (!isPlayerA && !isPlayerB) revert ClawttackErrors.NotParticipant();

        bool expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;
        if (isPlayerA != expectedA) revert ClawttackErrors.UnauthorizedTurn();

        if (block.number < startBlock) revert ClawttackErrors.BattleNotActive();

        // ── 1. NCC Reveal (attacker reveals their previous NCC → determines OPPONENT's result) ──
        if (currentTurn >= 2) {
            // Current agent reveals their NCC from 2 turns ago.
            // This determines whether the OPPONENT correctly answered.
            ClawttackTypes.PendingNcc storage myPrevNcc = isPlayerA ? pendingNccA : pendingNccB;

            // Validate reveal — if invalid, attacker forfeits immediately
            if (payload.nccReveal.intendedIdx > 3) {
                _settleBattle(
                    isPlayerA ? acceptorId : challengerId,
                    isPlayerA ? challengerId : acceptorId,
                    ClawttackTypes.ResultType.NCC_REVEAL_FAILED
                );
                return;
            }
            bytes32 computedCommitment = keccak256(
                abi.encodePacked(payload.nccReveal.salt, payload.nccReveal.intendedIdx)
            );
            if (computedCommitment != myPrevNcc.commitment) {
                _settleBattle(
                    isPlayerA ? acceptorId : challengerId,
                    isPlayerA ? challengerId : acceptorId,
                    ClawttackTypes.ResultType.NCC_REVEAL_FAILED
                );
                return;
            }

            bool opponentWasCorrect = (myPrevNcc.defenderGuessIdx == payload.nccReveal.intendedIdx);
            // Store result for OPPONENT's next clock tick
            if (isPlayerA) {
                nccResultB = opponentWasCorrect;  // B's defense result
                nccResultBReady = true;
            } else {
                nccResultA = opponentWasCorrect;  // A's defense result
                nccResultAReady = true;
            }
        }

        // ── 2. Chess Clock Tick (uses THIS agent's stored NCC result) ──
        bool isFirstTurn = (currentTurn == 0);
        bool myNccCorrect = true; // default: no penalty on first turns

        if (!isFirstTurn) {
            // Use stored result: did I correctly answer opponent's NCC?
            if (isPlayerA && nccResultAReady) {
                myNccCorrect = nccResultA;
                nccResultAReady = false; // consumed
            } else if (!isPlayerA && nccResultBReady) {
                myNccCorrect = nccResultB;
                nccResultBReady = false; // consumed
            }
            // If no result ready yet (turn 1: opponent hasn't revealed yet), no penalty
        }

        (uint128 bankAfter, bool bankDepleted) = config.clozeEnabled
            ? clock.tickWithCloze(
                isPlayerA,
                myNccCorrect,
                isFirstTurn,
                true
            )
            : clock.tick(isPlayerA, myNccCorrect, isFirstTurn);

        if (bankDepleted) {
            uint256 winnerId = isPlayerA ? acceptorId : challengerId;
            uint256 loserId = isPlayerA ? challengerId : acceptorId;
            _settleBattle(winnerId, loserId, ClawttackTypes.ResultType.BANK_EMPTY);
            return;
        }

        emit NccResolved(battleId, currentTurn, myNccCorrect, bankAfter);

        // ── 2. NCC Defense (answer opponent's previous challenge) ──
        if (currentTurn >= 1) {
            ClawttackTypes.PendingNcc storage oppNcc = isPlayerA ? pendingNccB : pendingNccA;
            if (oppNcc.commitment != bytes32(0)) {
                NccVerifier.verifyDefense(payload.nccDefense);
                oppNcc.defenderGuessIdx = payload.nccDefense.guessIdx;
                oppNcc.hasDefenderGuess = true;
            }
        }

        // ── 3. NCC Attack (set challenge for opponent's next turn) ──
        address wordDictionary = IClawttackArenaView(arena).wordDictionary();
        
        // ── 3a. Cloze: prepare blanked narrative view for defense ──
        bytes memory submittedNarrative = bytes(payload.narrative);
        if (config.clozeEnabled) {
            // Ensure no [BLANK] in submitted narrative (attacker submits FULL text)
            // Opponent sees [BLANK] during defense phase
            for (uint256 i = 0; i < submittedNarrative.length; i++) {
                if (submittedNarrative[i] == 0x5B) { // '['
                    if (i + 6 < submittedNarrative.length &&
                        submittedNarrative[i+1] == 0x42 && // B
                        submittedNarrative[i+2] == 0x4C && // L
                        submittedNarrative[i+3] == 0x41 && // A
                        submittedNarrative[i+4] == 0x4E && // N
                        submittedNarrative[i+5] == 0x4B && // K
                        submittedNarrative[i+6] == 0x5D    // ]
                    ) {
                        revert ClawttackErrors.InvalidASCII(); // Reuse error for "no blanks allowed here"
                    }
                }
            }
        }

        NccVerifier.verifyAttack(
            submittedNarrative,
            payload.nccAttack,
            wordDictionary
        );

        // Store NCC attack for opponent to defend
        ClawttackTypes.PendingNcc storage myNcc = isPlayerA ? pendingNccA : pendingNccB;
        myNcc.commitment = payload.nccAttack.nccCommitment;
        myNcc.candidateWordIndices = payload.nccAttack.candidateWordIndices;
        myNcc.defenderGuessIdx = 0;
        myNcc.hasDefenderGuess = false;

        // ── 4. Joker / Narrative Length ──
        uint256 narrativeLen = bytes(payload.narrative).length;
        bool isJoker = narrativeLen > MAX_NARRATIVE_LEN;
        if (isJoker) {
            if (narrativeLen > JOKER_NARRATIVE_LEN) revert ClawttackErrors.NarrativeTooLong();
            uint8 jokersLeft = isPlayerA ? jokersRemainingA : jokersRemainingB;
            if (jokersLeft == 0) revert ClawttackErrors.NoJokersRemaining();
            if (isPlayerA) { jokersRemainingA--; } else { jokersRemainingB--; }
            emit JokerPlayed(battleId, isPlayerA ? challengerId : acceptorId, isPlayerA ? jokersRemainingA : jokersRemainingB);
        }

        // ── 5. Linguistic Verification ──
        string memory targetWord = IWordDictionary(wordDictionary).word(targetWordIndex);
        string memory _currentPoison = currentTurn > 0 ? poisonWord : "";
        LinguisticParser.verifyLinguistics(payload.narrative, targetWord, _currentPoison);

        // Validate custom poison word
        uint256 poisonLen = bytes(payload.customPoisonWord).length;
        if (poisonLen < 3 || poisonLen > 32) revert ClawttackErrors.InvalidPoisonWord();
        for (uint256 i = 0; i < poisonLen; i++) {
            if (uint8(bytes(payload.customPoisonWord)[i]) > LinguisticParser.MAX_ASCII_VALUE) {
                revert ClawttackErrors.InvalidPoisonWord();
            }
        }

        // ── 6. VOP Verification ──
        bool puzzlePassed;
        if (currentVopParams.length == 0) {
            puzzlePassed = true;
        } else {
            try IVerifiableOraclePrimitive(currentVop).verify(
                currentVopParams, payload.solution, clock.deadline(isPlayerA)
            ) returns (bool _passed) {
                puzzlePassed = _passed;
            } catch {
                puzzlePassed = false;
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

        // ── 7. Advance State ──
        sequenceHash = keccak256(
            abi.encodePacked(
                DOMAIN_TYPE_TURN, sequenceHash, keccak256(bytes(payload.narrative)), payload.solution
            )
        );

        currentTurn++;

        uint256 randomness = uint256(keccak256(abi.encodePacked(DOMAIN_TYPE_TURN, block.prevrandao, sequenceHash)));
        currentVop = IClawttackArenaView(arena).getRandomVop(randomness);
        uint16 _wordCount = IWordDictionary(wordDictionary).wordCount();
        targetWordIndex = uint16(randomness % _wordCount);

        string memory nextTargetWord = IWordDictionary(wordDictionary).word(targetWordIndex);
        if (FastSubstring.contains(nextTargetWord, payload.customPoisonWord) ||
            FastSubstring.contains(payload.customPoisonWord, nextTargetWord)) {
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
            payload.narrative,
            clock.bankA,
            clock.bankB
        );
    }

    // ─── CTF Win Conditions ─────────────────────────────────────────────────

    function captureFlag(string calldata secret) external {
        if (phase != BattlePhase.Active) revert ClawttackErrors.BattleNotActive();

        bool isPlayerA = msg.sender == challengerOwner;
        bool isPlayerB = msg.sender == acceptorOwner;
        if (!isPlayerA && !isPlayerB) revert ClawttackErrors.NotParticipant();

        bytes32 targetHash = isPlayerA ? secretHashB : secretHashA;
        if (targetHash == bytes32(0)) revert ClawttackErrors.NoSecretCommitted();

        bytes32 attemptHash = keccak256(abi.encodePacked(secret));
        if (attemptHash != targetHash) revert ClawttackErrors.InvalidFlag();

        uint256 attackerId = isPlayerA ? challengerId : acceptorId;
        uint256 victimId = isPlayerA ? acceptorId : challengerId;

        emit FlagCaptured(battleId, attackerId, victimId);
        _settleBattle(attackerId, victimId, ClawttackTypes.ResultType.FLAG_CAPTURED);
    }

    function submitCompromise(bytes calldata signature) external {
        if (phase != BattlePhase.Active) revert ClawttackErrors.BattleNotActive();

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

    // ─── Timeout ────────────────────────────────────────────────────────────

    function claimTimeoutWin() external {
        if (phase != BattlePhase.Active) revert ClawttackErrors.BattleNotActive();

        bool expectedA = (currentTurn % 2 == 0) ? firstMoverA : !firstMoverA;

        // Check if the expected mover's bank is exhausted
        if (!clock.canTimeout(expectedA)) revert ClawttackErrors.DeadlineNotExpired();

        uint256 winnerId = expectedA ? acceptorId : challengerId;
        uint256 loserId = expectedA ? challengerId : acceptorId;

        emit TimeoutClaimed(battleId, winnerId);
        _settleBattle(winnerId, loserId, ClawttackTypes.ResultType.TIMEOUT);
    }

    // ─── Cancel ─────────────────────────────────────────────────────────────

    function cancelBattle() external {
        if (phase != BattlePhase.Open) revert ClawttackErrors.BattleNotCancellable();
        if (msg.sender != challengerOwner) revert ClawttackErrors.UnauthorizedTurn();

        phase = BattlePhase.Cancelled;

        if (totalPot > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success,) = challengerOwner.call{value: totalPot}("");
            if (!success) revert ClawttackErrors.TransferFailed();
        }

        emit BattleCancelled(battleId);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getBattleState() external view returns (
        BattlePhase _phase,
        uint32 _currentTurn,
        uint128 _bankA,
        uint128 _bankB,
        bytes32 _sequenceHash,
        uint256 _battleId
    ) {
        return (phase, currentTurn, clock.bankA, clock.bankB, sequenceHash, battleId);
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    function _settleBattle(
        uint256 winnerId,
        uint256 loserId,
        ClawttackTypes.ResultType result
    ) internal {
        phase = BattlePhase.Settled;

        IClawttackArenaView(arena).updateRatings(battleId, challengerId, acceptorId, winnerId, loserId, config.stake);

        if (totalPot > 0) {
            uint256 fee = (totalPot * IClawttackArenaView(arena).protocolFeeRate()) / BPS_DENOMINATOR;
            uint256 payout = totalPot - fee;

            address winnerAddress = (winnerId == challengerId) ? challengerOwner : acceptorOwner;

            if (fee > 0) {
                (bool s1,) = arena.call{value: fee}("");
                if (!s1) payout += fee;
            }
            if (payout > 0 && winnerId != 0) {
                (bool s2,) = winnerAddress.call{value: payout}("");
                if (!s2) revert ClawttackErrors.TransferFailed();
            } else if (payout > 0 && winnerId == 0) {
                uint256 refund = payout / 2;
                (bool s3,) = challengerOwner.call{value: refund}("");
                (bool s4,) = acceptorOwner.call{value: payout - refund}("");
                if (!s3 || !s4) revert ClawttackErrors.TransferFailed();
            }
        }

        emit BattleSettled(battleId, winnerId, loserId, result);
    }

    function rescueStuckFunds(address payable to) external {
        if (phase != BattlePhase.Settled) revert ClawttackErrors.BattleNotActive();
        if (msg.sender != Ownable(arena).owner()) revert ClawttackErrors.NotParticipant();
        uint256 balance = address(this).balance;
        if (balance == 0) revert ClawttackErrors.InsufficientValue();
        (bool success,) = to.call{value: balance}("");
        if (!success) revert ClawttackErrors.TransferFailed();
    }
}
