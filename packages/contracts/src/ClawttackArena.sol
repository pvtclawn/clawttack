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

    uint256 public constant MIN_RATED_STAKE          = 0.001 ether;
    uint256 public constant MAX_CREATION_FEE         = 0.01 ether;
    uint256 public constant MAX_REGISTRATION_FEE     = 0.1 ether;
    uint256 public constant MAX_PROTOCOL_FEE_RATE    = 1_000;

    uint32 public constant DEFAULT_ELO_RATING        = 1500;
    uint32 public constant MAX_ELO_DIFF              = 300;

    uint32 public constant MIN_WARMUP_BLOCKS         = 15;
    uint32 public constant MAX_WARMUP_BLOCKS         = 150;

    uint8  public constant MAX_JOKERS                = 2;

    // ─── Immutables ──────────────────────────────────────────────────────────

    address public immutable wordDictionary;

    // ─── Storage ─────────────────────────────────────────────────────────────

    address public battleImplementation;

    uint256 public agentRegistrationFee;
    uint256 public battleCreationFee;
    uint256 public protocolFeeRate;

    uint256 public protocolFees;

    uint256 public battlesCount;
    uint256 public agentsCount;

    mapping(uint256 => ClawttackTypes.AgentProfile) public agents;
    mapping(uint256 => address) public battles;

    // ─── VOP Registry ────────────────────────────────────────────────────────        

    address[] public vopRegistry;
    mapping(address => bool) public isVopRegistered;
    mapping(uint8 => bool) public deactivatedVOPs;

    // ─── Events ──────────────────────────────────────────────────────────────

    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event BattleCreated(uint256 indexed battleId, uint256 indexed challengerId, uint256 stake, uint256 targetAgentId);
    event RatingUpdated(uint256 indexed agentId, uint32 newRating);
    event ProtocolFeeUpdated(uint256 oldRate, uint256 newRate);
    event BattleCreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event AgentRegistrationFeeUpdated(uint256 oldFee, uint256 newFee);
    event VOPAdded(address indexed vopAddress);
    event VOPDeactivated(uint8 indexed index, address indexed vopAddress);

    // ─── Constructor / Receive ───────────────────────────────────────────────

    constructor(address _wordDictionary) Ownable(msg.sender) {
        if (_wordDictionary == address(0)) revert ClawttackErrors.InvalidCall();
        wordDictionary = _wordDictionary;
    }

    receive() external payable {
        protocolFees += msg.value;
    }

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

    function withdrawFees(address payable to) external onlyOwner {
        uint256 amount = protocolFees;
        if (amount == 0) revert ClawttackErrors.InsufficientValue();
        protocolFees = 0;

        (bool success,) = to.call{value: amount}("");
        if (!success) revert ClawttackErrors.TransferFailed();
    }

    // ─── External: VOP Management ────────────────────────────────────────────

    function addVop(address vopAddress) external onlyOwner {
        if (isVopRegistered[vopAddress]) revert ClawttackErrors.VOPAlreadyRegistered();
        isVopRegistered[vopAddress] = true;
        vopRegistry.push(vopAddress);
        emit VOPAdded(vopAddress);
    }

    function deactivateVop(uint8 index) external onlyOwner {
        if (index >= vopRegistry.length) revert ClawttackErrors.VopIndexOutOfRange();
        deactivatedVOPs[index] = true;
        emit VOPDeactivated(index, vopRegistry[index]);
    }

    uint256 public totalVolume; // Cumulative ETH staked across all battles

    // ─── External: Core Protocol ─────────────────────────────────────────────

    /**
     * @notice Registers a new AI agent and assigns an immutable incremental ID.
     * @dev The owner is set to msg.sender. The agent begins with default Elo ratings.
     * @return agentId The sequential unique identifier assigned to the newly registered agent.
     */
    function registerAgent() external payable nonReentrant returns (uint256 agentId) {
        if (msg.value != agentRegistrationFee) revert ClawttackErrors.InsufficientValue();
        protocolFees += msg.value;
        unchecked { agentId = ++agentsCount; }

        agents[agentId] = ClawttackTypes.AgentProfile({
            owner: msg.sender,
            eloRating: DEFAULT_ELO_RATING,
            totalWins: 0,
            totalLosses: 0,
            totalStaked: 0,
            totalWon: 0
        });

        emit AgentRegistered(agentId, msg.sender);
    }

    /**
     * @notice Creates a new battle with chess-clock timing.
     * @dev Deploys an EIP-1167 clone of the battle implementation.
     * @param challengerId The challenger's registered agent ID.
     * @param config The battle configuration (chess clock handles timing).
     * @return battleAddress The address of the deployed battle clone.
     */
    function createBattle(uint256 challengerId, ClawttackTypes.BattleConfig calldata config)
        external
        payable
        nonReentrant
        returns (address battleAddress)
    {
        if (battleImplementation == address(0)) revert ClawttackErrors.InvalidCall();
        if (agents[challengerId].owner == address(0)) revert ClawttackErrors.NotParticipant();
        if (agents[challengerId].owner != msg.sender) revert ClawttackErrors.NotAgentOwner();

        if (config.maxJokers > MAX_JOKERS) revert ClawttackErrors.ConfigOutOfBounds();
        if (config.warmupBlocks < MIN_WARMUP_BLOCKS || config.warmupBlocks > MAX_WARMUP_BLOCKS) {
            revert ClawttackErrors.ConfigOutOfBounds();
        }

        if (msg.value != config.stake + battleCreationFee) revert ClawttackErrors.InsufficientValue();
        protocolFees += battleCreationFee;

        uint256 battleId;
        unchecked { battleId = ++battlesCount; }

        battleAddress = Clones.clone(battleImplementation);
        battles[battleId] = battleAddress;

        IClawttackBattle(battleAddress).initialize(address(this), battleId, challengerId, msg.sender, config);

        if (config.stake > 0) {
            (bool success,) = battleAddress.call{value: config.stake}("");
            if (!success) revert ClawttackErrors.TransferFailed();
        }

        emit BattleCreated(battleId, challengerId, config.stake, config.targetAgentId);
    }

    /**
     * @notice Callback from Battle clones when a battle is settled.
     * @dev Only callable by active Battle clones. Records outcome and updates Elo.
     * @param battleId    The ID of the settled battle.
     * @param winnerId    The ID of the winning agent.
     * @param loserId     The ID of the losing agent.
     * @param battleStake Per-player stake. Unrated matches (stake < MIN) skip Elo.
     */
    function settleBattle(
        uint256 battleId,
        uint256 winnerId,
        uint256 loserId,
        uint256 battleStake
    ) external {
        if (battles[battleId] != msg.sender) revert ClawttackErrors.InvalidCall();
        if (winnerId > agentsCount || loserId > agentsCount) revert ClawttackErrors.InvalidCall();
        if (winnerId == 0 || loserId == 0) revert ClawttackErrors.InvalidCall();

        _recordBattleOutcome(winnerId, loserId, battleStake);

        if (battleStake >= MIN_RATED_STAKE) {
            _updateElo(winnerId, loserId);
        }
    }

    // ─── Internal: Battle Accounting ─────────────────────────────────────────

    function _recordBattleOutcome(
        uint256 winnerId,
        uint256 loserId,
        uint256 stake
    ) internal {
        unchecked {
            agents[winnerId].totalWins  += 1;
            agents[loserId].totalLosses += 1;
        }

        if (stake > 0) {
            agents[winnerId].totalStaked += stake;
            agents[loserId].totalStaked  += stake;
            totalVolume += stake * 2;
            uint256 protocolCut = (stake * 2 * protocolFeeRate) / 10000;
            agents[winnerId].totalWon += stake - (protocolCut / 2);
        }
    }

    function _updateElo(uint256 winnerId, uint256 loserId) internal {
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
    }

    // ─── External: View ──────────────────────────────────────────────────────

    function getVopCount() external view returns (uint256) {
        return vopRegistry.length;
    }

    function getVopByIndex(uint8 index) external view returns (address) {
        if (index >= vopRegistry.length) revert ClawttackErrors.VopIndexOutOfRange();
        return vopRegistry[index];
    }

    function isVopActive(uint8 index) external view returns (bool) {
        if (index >= vopRegistry.length) return false;
        return !deactivatedVOPs[index];
    }
}
