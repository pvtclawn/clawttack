// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Clones} from "openzeppelin-contracts/contracts/proxy/Clones.sol";
import {ClawttackTypes} from "./libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "./libraries/ClawttackErrors.sol";
import {EloMath} from "./libraries/EloMath.sol";
import {IClawttackBattle} from "./interfaces/IClawttackBattle.sol";

/**
 * @title ClawttackArena
 * @notice The central factory and matchmaking hub for the Clawttack system.
 * @dev Manages the deployment of EIP-1167 clones for individual battles, handles protocol fees,
 * and maintains the persistent Agent Elo ratings via Glicko-2 math.
 */
contract ClawttackArena {
    address public owner;
    address public battleImplementation;
    address public vopRegistry;
    address public wordDictionary;

    uint256 public agentRegistrationFee;
    uint256 public battleCreationFee;
    uint256 public protocolFeeRate;
    
    uint256 public constant MIN_RATED_STAKE = 0.0001 ether;
    uint256 public constant MAX_CREATION_FEE = 0.01 ether;
    uint256 public constant MAX_REGISTRATION_FEE = 0.1 ether;
    uint256 public constant MAX_PROTOCOL_FEE_RATE = 1_000;

    uint32 public constant DEFAULT_ELO_RATING = 1500;
    uint32 public constant MAX_ELO_DIFF = 400;

    uint32 public constant MIN_TIMEOUT_BLOCKS = 15;
    uint32 public constant MAX_TIMEOUT_BLOCKS = 300;
    uint32 public constant MIN_WARMUP_BLOCKS = 5;
    uint32 public constant MAX_WARMUP_BLOCKS = 150;

    uint8 public constant MIN_TURNS = 10;
    uint8 public constant MAX_TURNS = 40;
    uint8 public constant MAX_JOKERS = 3;

    uint256 public battlesCount;
    uint256 public agentsCount;

    mapping(uint256 => ClawttackTypes.AgentProfile) public agents;
    mapping(uint256 => address) public battles;

    // Events
    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event BattleCreated(
        uint256 indexed battleId, uint256 indexed challengerId, uint256 stake, uint32 baseTimeoutBlocks, uint8 maxTurns
    );
    event RatingUpdated(uint256 indexed agentId, uint32 newRating);
    event ProtocolFeeUpdated(uint256 oldRate, uint256 newRate);
    event BattleCreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event AgentRegistrationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) revert ClawttackErrors.OnlyOwner();
    }

    function setBattleImplementation(address _impl) external onlyOwner {
        battleImplementation = _impl;
    }

    function setVopRegistry(address _registry) external onlyOwner {
        vopRegistry = _registry;
    }

    function setWordDictionary(address _dictionary) external onlyOwner {
        wordDictionary = _dictionary;
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

    function withdrawFees(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ClawttackErrors.InsufficientValue();
        (bool success,) = to.call{value: balance}("");
        if (!success) revert ClawttackErrors.TransferFailed();
    }

    /**
     * @notice Registers a new AI agent and assigns an immutable incremental ID.
     * @dev The owner is set to msg.sender. The agent begins with default Elo ratings.
     * @return agentId The sequential unique identifier assigned to the newly registered agent.
     */
    function registerAgent() external payable returns (uint256 agentId) {
        if (msg.value != agentRegistrationFee) revert ClawttackErrors.InsufficientValue();
        unchecked {
            agentId = ++agentsCount;
        }

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
        returns (address battleAddress)
    {
        if (agents[challengerId].owner == address(0)) revert ClawttackErrors.NotParticipant();
        if (agents[challengerId].owner != msg.sender) revert ClawttackErrors.NotAgentOwner();

        // Bounds checking
        if (config.baseTimeoutBlocks < MIN_TIMEOUT_BLOCKS || config.baseTimeoutBlocks > MAX_TIMEOUT_BLOCKS) {
            revert ClawttackErrors.ConfigOutOfBounds();
        }
        if (config.maxTurns < MIN_TURNS || config.maxTurns > MAX_TURNS) revert ClawttackErrors.ConfigOutOfBounds();
        if (config.maxJokers > MAX_JOKERS) revert ClawttackErrors.ConfigOutOfBounds();
        if (config.warmupBlocks < MIN_WARMUP_BLOCKS || config.warmupBlocks > MAX_WARMUP_BLOCKS) revert ClawttackErrors.ConfigOutOfBounds();

        if (msg.value != config.stake + battleCreationFee) revert ClawttackErrors.InsufficientValue();

        uint256 battleId;
        unchecked {
            battleId = ++battlesCount;
        }
        battleAddress = Clones.clone(battleImplementation);
        battles[battleId] = battleAddress;

        IClawttackBattle(battleAddress).initialize(address(this), battleId, challengerId, msg.sender, config);

        // Forward the stake to the battle clone. Creation fee stays here.
        if (config.stake > 0) {
            (bool success,) = battleAddress.call{value: config.stake}("");
            if (!success) revert ClawttackErrors.TransferFailed();
        }

        emit BattleCreated(battleId, challengerId, config.stake, config.baseTimeoutBlocks, config.maxTurns);
    }

    /**
     * @notice Updates the persistent Elo ratings of agents after a battle concludes.
     * @dev Only callable by active Battle clones. Processes mathematical updates via EloMath.
     * @param battleId The ID of the battle triggering the update.
     * @param winnerId The ID of the winning agent (0 if a draw).
     * @param loserId The ID of the losing agent (0 if a draw).
     * @param battleStake The total stake of the battle. Unrated matches (stake < MIN) do not affect Elo.
     */
    function updateRatings(uint256 battleId, uint256 winnerId, uint256 loserId, uint256 battleStake) external {
        if (battles[battleId] != msg.sender) revert ClawttackErrors.InvalidCall();

        if (winnerId != 0) {
            unchecked {
                agents[winnerId].totalWins += 1;
                agents[loserId].totalLosses += 1;
            }
        }

        if (battleStake >= MIN_RATED_STAKE && winnerId != 0) {
            (uint32 wRating, uint32 lRating) = EloMath.updateElo(
                agents[winnerId].eloRating,
                agents[loserId].eloRating,
                32 // Fixed K-factor
            );
            
            agents[winnerId].eloRating = wRating;
            agents[loserId].eloRating = lRating;
            
            emit RatingUpdated(winnerId, wRating);
            emit RatingUpdated(loserId, lRating);
        }
    }
}
