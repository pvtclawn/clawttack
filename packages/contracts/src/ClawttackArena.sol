// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Clones} from "openzeppelin-contracts/contracts/proxy/Clones.sol";
import {Ownable2Step, Ownable} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "./libraries/ClawttackErrors.sol";
import {EloMath} from "./libraries/EloMath.sol";
import {IClawttackBattle} from "./interfaces/IClawttackBattle.sol";

/**
 * @title ClawttackArena
 * @notice The central factory and matchmaking hub for the Clawttack system.
 * @dev Manages the deployment of EIP-1167 clones for individual battles,
 * maintains the persistent Agent Elo ratings, handles protocol fees and VOP management.
 */
contract ClawttackArena is Ownable2Step, ReentrancyGuard {

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MIN_RATED_STAKE      = 0.001 ether;  // ~$3 on Base — meaningful anti-farming floor
    uint256 public constant MAX_CREATION_FEE     = 0.01 ether;
    uint256 public constant MAX_REGISTRATION_FEE = 0.1 ether;
    uint256 public constant MAX_PROTOCOL_FEE_RATE = 1_000;       // BPS

    uint32 public constant DEFAULT_ELO_RATING    = 1500;
    uint32 public constant MAX_ELO_DIFF          = 300;          // ~85% expected win — fairer matchmaking

    uint32 public constant MIN_TIMEOUT_BLOCKS    = 25;           // ~50s on Base — reliable under mempool load
    uint32 public constant MAX_TIMEOUT_BLOCKS    = 300;          // ~10 min on Base — generous ceiling
    uint32 public constant MIN_WARMUP_BLOCKS     = 15;           // ~30s on Base — agent monitoring setup
    uint32 public constant MAX_WARMUP_BLOCKS     = 150;          // ~5 min on Base

    uint8  public constant MIN_TURNS             = 12;           // 6 per player — minimum strategic depth
    uint8  public constant MAX_TURNS             = 40;
    uint8  public constant MAX_JOKERS            = 2;            // scarce resource, not a routine tool

    // ─── Immutables ──────────────────────────────────────────────────────────

    address public immutable wordDictionary;                     // BIP39 is frozen — set once at deploy

    // ─── Storage ─────────────────────────────────────────────────────────────

    address public battleImplementation;

    uint256 public agentRegistrationFee;
    uint256 public battleCreationFee;
    uint256 public protocolFeeRate;

    uint256 public battlesCount;
    uint256 public agentsCount;

    mapping(uint256 => ClawttackTypes.AgentProfile) public agents;
    mapping(uint256 => address) public battles;

    // ─── VOP Registry ──────────────────────────────────────────────

    address[] public activeVOPs;
    mapping(address => bool) public isVopRegistered;

    // ─── Events ──────────────────────────────────────────────────────────────

    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event BattleCreated(
        uint256 indexed battleId, uint256 indexed challengerId, uint256 stake, uint32 baseTimeoutBlocks, uint8 maxTurns
    );
    event RatingUpdated(uint256 indexed agentId, uint32 newRating);
    event ProtocolFeeUpdated(uint256 oldRate, uint256 newRate);
    event BattleCreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event AgentRegistrationFeeUpdated(uint256 oldFee, uint256 newFee);
    event VOPAdded(address indexed vopAddress);
    event VOPRemoved(address indexed vopAddress);

    // ─── Constructor / Receive ───────────────────────────────────────────────

    constructor(address _wordDictionary) Ownable(msg.sender) {
        if (_wordDictionary == address(0)) revert ClawttackErrors.InvalidCall();
        wordDictionary = _wordDictionary;
    }

    receive() external payable {}

    // ─── External: Admin ─────────────────────────────────────────────────────

    function setBattleImplementation(address _impl) external onlyOwner {
        if (_impl == address(0)) revert ClawttackErrors.InvalidCall();
        battleImplementation = _impl;
    }

    function setBattleCreationFee(uint256 _fee) external onlyOwner {
        if (_fee > MAX_CREATION_FEE) revert ClawttackErrors.FeeTooHigh();
        emit BattleCreationFeeUpdated(battleCreationFee, _fee);
        battleCreationFee = _fee;
    }

    function setAgentRegistrationFee(uint256 _fee) external onlyOwner {
        if (_fee > MAX_REGISTRATION_FEE) revert ClawttackErrors.FeeTooHigh();
        emit AgentRegistrationFeeUpdated(agentRegistrationFee, _fee);
        agentRegistrationFee = _fee;
    }

    function setProtocolFeeRate(uint256 _rate) external onlyOwner {
        if (_rate > MAX_PROTOCOL_FEE_RATE) revert ClawttackErrors.FeeTooHigh();
        emit ProtocolFeeUpdated(protocolFeeRate, _rate);
        protocolFeeRate = _rate;
    }

    function withdrawFees(address payable to) external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ClawttackErrors.InsufficientValue();
        (bool success,) = to.call{value: balance}("");
        if (!success) revert ClawttackErrors.TransferFailed();
    }

    // ─── External: VOP Management ────────────────────────────────────────────

    function addVop(address vopAddress) external onlyOwner {
        if (isVopRegistered[vopAddress]) revert ClawttackErrors.VOPAlreadyRegistered();
        isVopRegistered[vopAddress] = true;
        activeVOPs.push(vopAddress);
        emit VOPAdded(vopAddress);
    }

    function removeVop(address vopAddress) external onlyOwner {
        if (!isVopRegistered[vopAddress]) revert ClawttackErrors.VOPNotRegistered();
        isVopRegistered[vopAddress] = false;
        for (uint256 i = 0; i < activeVOPs.length; i++) {
            if (activeVOPs[i] == vopAddress) {
                activeVOPs[i] = activeVOPs[activeVOPs.length - 1];
                activeVOPs.pop();
                break;
            }
        }
        emit VOPRemoved(vopAddress);
    }

    // ─── External: Core Protocol ─────────────────────────────────────────────

    /**
     * @notice Registers a new AI agent and assigns an immutable incremental ID.
     * @dev The owner is set to msg.sender. The agent begins with default Elo ratings.
     * @return agentId The sequential unique identifier assigned to the newly registered agent.
     */
    function registerAgent() external payable nonReentrant returns (uint256 agentId) {
        if (msg.value != agentRegistrationFee) revert ClawttackErrors.InsufficientValue();
        unchecked { agentId = ++agentsCount; }

        agents[agentId] = ClawttackTypes.AgentProfile({
            owner: msg.sender,
            eloRating: DEFAULT_ELO_RATING,
            totalWins: 0,
            totalLosses: 0
        });

        emit AgentRegistered(agentId, msg.sender);
    }

    /**
     * @notice Creates a new Battle by cloning the `battleImplementation` and injecting stakes.
     * @dev Validates constraints and transfers stakes. Only registered agents can initiate battles.
     * @param challengerId The registered ID of the initiating AI Agent.
     * @param config The requested game parameters including stakes, timeouts, and targeted opponents.
     * @return battleAddress The address of the deployed EIP-1167 ClawttackBattle clone.
     */
    function createBattle(uint256 challengerId, ClawttackTypes.BattleConfig calldata config)
        external
        payable
        nonReentrant
        returns (address battleAddress)
    {
        if (agents[challengerId].owner == address(0)) revert ClawttackErrors.NotParticipant();
        if (agents[challengerId].owner != msg.sender) revert ClawttackErrors.NotAgentOwner();

        if (config.baseTimeoutBlocks < MIN_TIMEOUT_BLOCKS || config.baseTimeoutBlocks > MAX_TIMEOUT_BLOCKS) {
            revert ClawttackErrors.ConfigOutOfBounds();
        }
        if (config.maxTurns < MIN_TURNS || config.maxTurns > MAX_TURNS) revert ClawttackErrors.ConfigOutOfBounds();
        if (config.maxJokers > MAX_JOKERS) revert ClawttackErrors.ConfigOutOfBounds();
        if (config.warmupBlocks < MIN_WARMUP_BLOCKS || config.warmupBlocks > MAX_WARMUP_BLOCKS) revert ClawttackErrors.ConfigOutOfBounds();

        if (msg.value != config.stake + battleCreationFee) revert ClawttackErrors.InsufficientValue();

        uint256 battleId;
        unchecked { battleId = ++battlesCount; }

        battleAddress = Clones.clone(battleImplementation);
        battles[battleId] = battleAddress;

        IClawttackBattle(battleAddress).initialize(address(this), battleId, challengerId, msg.sender, config);

        if (config.stake > 0) {
            (bool success,) = battleAddress.call{value: config.stake}("");
            if (!success) revert ClawttackErrors.TransferFailed();
        }

        emit BattleCreated(battleId, challengerId, config.stake, config.baseTimeoutBlocks, config.maxTurns);
    }

    /**
     * @notice Updates the persistent Elo ratings of agents after a battle concludes.
     * @dev Only callable by active Battle clones. Processes mathematical updates via EloMath.
     * @param battleId      The ID of the battle triggering the update.
     * @param challengerId_ The challenger agent ID.
     * @param acceptorId_   The acceptor agent ID.
     * @param winnerId      The ID of the winning agent (0 if a draw).
     * @param loserId       The ID of the losing agent (0 if a draw).
     * @param battleStake   The total stake. Unrated matches (stake < MIN) do not affect Elo.
     */
    function updateRatings(
        uint256 battleId,
        uint256 challengerId_,
        uint256 acceptorId_,
        uint256 winnerId,
        uint256 loserId,
        uint256 battleStake
    ) external {
        if (battles[battleId] != msg.sender) revert ClawttackErrors.InvalidCall();
        if (winnerId > agentsCount || loserId > agentsCount) revert ClawttackErrors.InvalidCall();
        if (challengerId_ > agentsCount || acceptorId_ > agentsCount) revert ClawttackErrors.InvalidCall();

        if (winnerId != 0) {
            unchecked {
                agents[winnerId].totalWins  += 1;
                agents[loserId].totalLosses += 1;
            }
        }

        if (battleStake < MIN_RATED_STAKE) return; // Unrated — skip rating update

        if (winnerId != 0) {
            // ─── Decisive result ─────────────────────────────────────────────
            uint32 kWinner = EloMath.kFactor(agents[winnerId].totalWins + agents[winnerId].totalLosses);
            uint32 kLoser  = EloMath.kFactor(agents[loserId].totalWins  + agents[loserId].totalLosses);

            (uint32 wRating, uint32 lRating) = EloMath.updateElo(
                agents[winnerId].eloRating,
                agents[loserId].eloRating,
                kWinner,
                kLoser
            );

            agents[winnerId].eloRating = wRating;
            agents[loserId].eloRating  = lRating;

            emit RatingUpdated(winnerId, wRating);
            emit RatingUpdated(loserId,  lRating);
        } else {
            // ─── Draw: pull ratings toward equilibrium ───────────────────────
            uint32 kA = EloMath.kFactor(agents[challengerId_].totalWins + agents[challengerId_].totalLosses);
            uint32 kB = EloMath.kFactor(agents[acceptorId_].totalWins   + agents[acceptorId_].totalLosses);

            (uint32 rA, uint32 rB) = EloMath.drawElo(
                agents[challengerId_].eloRating,
                agents[acceptorId_].eloRating,
                kA,
                kB
            );

            agents[challengerId_].eloRating = rA;
            agents[acceptorId_].eloRating   = rB;

            emit RatingUpdated(challengerId_, rA);
            emit RatingUpdated(acceptorId_,   rB);
        }
    }

    // ─── External: View ──────────────────────────────────────────────────────

    function getRandomVop(uint256 seed) external view returns (address) {
        if (activeVOPs.length == 0) revert ClawttackErrors.RegistryEmpty();
        return activeVOPs[seed % activeVOPs.length];
    }

    function getVopCount() external view returns (uint256) {
        return activeVOPs.length;
    }
}
