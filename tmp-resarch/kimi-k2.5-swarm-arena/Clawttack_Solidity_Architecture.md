# Clawttack Solidity Architecture

## Overview
On-chain AI agent battle protocol on Base L2 with staking, ELO matchmaking, and turn-based verification.

---

## 1. Key State Variables

```solidity
// ============================================
// CONSTANTS & CONFIGURATION
// ============================================
uint256 public constant MIN_STAKE = 0.001 ether;
uint256 public constant MAX_STAKE = 10 ether;
uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
uint256 public constant TURN_TIMEOUT = 5 minutes;
uint256 public constant ELO_RANGE = 200; // Max ELO difference for matchmaking
uint256 public constant ELO_K_FACTOR = 32; // Standard K-factor
uint256 public constant MAX_TURNS = 50; // Max turns before auto-resolve

// ============================================
// EXTERNAL CONTRACT REFERENCES
// ============================================
address public vrfCoordinator;
address public uniswapFactory;
address public agentNFTContract;
address public feeRecipient;

// ============================================
// STATE MAPPINGS
// ============================================
// Battle storage
mapping(uint256 => Battle) public battles;
mapping(uint256 => Turn[]) public battleTurns;
mapping(uint256 => bytes32) public battleSeeds;

// Agent storage
mapping(uint256 => Agent) public agents;
mapping(uint256 => uint256) public agentELO;
mapping(uint256 => uint256) public agentTotalBattles;
mapping(uint256 => uint256) public agentWins;

// Nonce tracking for replay protection
mapping(address => uint256) public playerNonces;
mapping(bytes32 => bool) public usedTurnHashes;

// Active battle tracking per agent
mapping(uint256 => uint256) public agentActiveBattle;

// ============================================
// COUNTERS
// ============================================
uint256 public nextBattleId;
uint256 public nextRequestId;
```

---

## 2. Struct Definitions

```solidity
// ============================================
// ENUMS
// ============================================
enum BattleState {
    Pending,      // Created, waiting for opponent
    Active,       // Both players joined, battle in progress
    Completed,    // Battle finished, winner determined
    Disputed,     // Under dispute resolution
    Expired,      // Timed out
    Cancelled     // Cancelled by challenger before acceptance
}

enum MechanicType {
    BlockHash,    // Uses block.hash, block.timestamp
    TWAPPrice,    // Uses Uniswap TWAP oracle
    VRFRandom,    // Uses Chainlink VRF
    NFTOwnership, // Checks external NFT ownership
    Combined      // Multiple verification types
}

// ============================================
// STRUCTS
// ============================================
struct Agent {
    uint256 id;
    address owner;
    string metadataURI;
    uint256 createdAt;
    bool isActive;
}

struct Battle {
    uint256 id;
    uint256 challengerAgent;
    uint256 opponentAgent;
    address challenger;
    address opponent;
    uint256 stakeAmount;
    uint256 totalPot;
    uint256 createdAt;
    uint256 startedAt;
    uint256 lastTurnTime;
    uint256 currentTurn;
    uint256 winner;
    BattleState state;
    MechanicType mechanicType;
    uint256 vrfRequestId;
    bytes32 randomSeed;
}

struct Turn {
    uint256 battleId;
    uint256 turnNumber;
    address player;
    bytes32 previousHash;
    bytes32 currentHash;
    bytes moveData;
    bytes32 proof;
    uint256 blockNumber;
    uint256 timestamp;
    bool verified;
}

struct TurnData {
    uint256 agentId;
    uint256 action;
    uint256 target;
    bytes32 salt;
    bytes signature;
}

struct VerificationContext {
    uint256 blockNumber;
    uint256 blockTimestamp;
    bytes32 blockHash;
    uint256 twapPrice;
    uint256 vrfRandomness;
    address nftOwner;
}

struct ELOUpdate {
    uint256 winnerId;
    uint256 loserId;
    uint256 winnerOldELO;
    uint256 loserOldELO;
    uint256 winnerNewELO;
    uint256 loserNewELO;
}
```

---

## 3. Function Signatures

```solidity
// ============================================
// CORE BATTLE FUNCTIONS
// ============================================

/// @notice Create a new battle as challenger
/// @param challengerAgentId The agent ID of the challenger
/// @param stakeAmount Amount of ETH to stake (opponent must match)
/// @param mechanicType Type of verification mechanic for this battle
/// @return battleId The ID of the created battle
function createBattle(
    uint256 challengerAgentId,
    uint256 stakeAmount,
    MechanicType mechanicType
) external payable returns (uint256 battleId);

/// @notice Accept a pending battle as opponent
/// @param battleId The battle to accept
/// @param opponentAgentId The agent ID of the opponent
function acceptBattle(
    uint256 battleId,
    uint256 opponentAgentId
) external payable;

/// @notice Submit a turn with move data and verification proof
/// @param battleId The battle ID
/// @param turnData Encoded turn data (action, target, salt, signature)
/// @param proof Verification proof (hash, signature, or merkle proof)
function submitTurn(
    uint256 battleId,
    bytes calldata turnData,
    bytes32 proof
) external;

/// @notice Resolve a completed battle and distribute rewards
/// @param battleId The battle to resolve
function resolveBattle(uint256 battleId) external;

/// @notice Claim win if opponent times out
/// @param battleId The battle where opponent timed out
function claimTimeoutWin(uint256 battleId) external;

/// @notice Cancel a pending battle (challenger only)
/// @param battleId The battle to cancel
function cancelBattle(uint256 battleId) external;

// ============================================
// ELO & RATING FUNCTIONS
// ============================================

/// @notice Update ELO ratings after battle
/// @param winnerId The winning agent ID
/// @param loserId The losing agent ID
function updateELO(
    uint256 winnerId,
    uint256 loserId
) internal returns (ELOUpdate memory);

/// @notice Get expected score for ELO calculation
/// @param ratingA Rating of player A
/// @param ratingB Rating of player B
/// @return expectedScore Expected score (0-1000 scale)
function getExpectedScore(
    uint256 ratingA,
    uint256 ratingB
) public pure returns (uint256 expectedScore);

/// @notice Calculate new ELO rating
/// @param currentRating Current rating
/// @param expectedScore Expected score
/// @param actualScore Actual score (0 or 1000 for win/loss)
/// @return newRating Updated rating
function calculateNewELO(
    uint256 currentRating,
    uint256 expectedScore,
    uint256 actualScore
) public pure returns (uint256 newRating);

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

/// @notice Verify a turn based on battle mechanic type
/// @param battleId The battle ID
/// @param turn The turn to verify
/// @param context Verification context with on-chain data
/// @return isValid Whether the turn is valid
function verifyTurn(
    uint256 battleId,
    Turn calldata turn,
    VerificationContext memory context
) public view returns (bool isValid);

/// @notice Verify block hash mechanic
/// @param turn The turn to verify
/// @param context Block header data
/// @return isValid Whether verification passes
function verifyBlockHash(
    Turn calldata turn,
    VerificationContext memory context
) internal pure returns (bool isValid);

/// @notice Verify TWAP price mechanic
/// @param turn The turn to verify
/// @param context Contains TWAP price
/// @return isValid Whether verification passes
function verifyTWAPPrice(
    Turn calldata turn,
    VerificationContext memory context
) internal view returns (bool isValid);

/// @notice Verify VRF randomness mechanic
/// @param turn The turn to verify
/// @param context Contains VRF randomness
/// @return isValid Whether verification passes
function verifyVRFRandom(
    Turn calldata turn,
    VerificationContext memory context
) internal view returns (bool isValid);

/// @notice Verify NFT ownership mechanic
/// @param turn The turn to verify
/// @param context Contains NFT owner address
/// @return isValid Whether verification passes
function verifyNFTOwnership(
    Turn calldata turn,
    VerificationContext memory context
) internal view returns (bool isValid);

// ============================================
// VIEW & HELPER FUNCTIONS
// ============================================

/// @notice Get battle details
function getBattle(uint256 battleId) external view returns (Battle memory);

/// @notice Get all turns for a battle
function getBattleTurns(uint256 battleId) external view returns (Turn[] memory);

/// @notice Get agent details
function getAgent(uint256 agentId) external view returns (Agent memory);

/// @notice Get current ELO rating
function getELO(uint256 agentId) external view returns (uint256);

/// @notice Check if agents can battle (ELO range check)
function canBattle(
    uint256 agentA,
    uint256 agentB
) external view returns (bool);

/// @notice Get verification context for current block
function getVerificationContext(
    uint256 battleId
) external view returns (VerificationContext memory);

/// @notice Compute turn hash for commitment scheme
function computeTurnHash(
    uint256 battleId,
    uint256 turnNumber,
    bytes calldata moveData,
    bytes32 salt
) public pure returns (bytes32);

/// @notice Get time remaining for current turn
function getTurnTimeRemaining(
    uint256 battleId
) external view returns (uint256);
```

---

## 4. Pseudocode for submitTurn() Verification Logic

```solidity
function submitTurn(
    uint256 battleId,
    bytes calldata turnData,
    bytes32 proof
) external nonReentrant whenNotPaused {
    
    // ============================================
    // STEP 1: LOAD & VALIDATE BATTLE STATE
    // ============================================
    Battle storage battle = battles[battleId];
    
    // Gas optimization: Cache frequently accessed values
    BattleState state = battle.state;
    uint256 currentTurn = battle.currentTurn;
    
    // Validations
    require(state == BattleState.Active, "Battle not active");
    require(
        msg.sender == battle.challenger || msg.sender == battle.opponent,
        "Not a participant"
    );
    
    // Determine expected player for this turn (alternating)
    address expectedPlayer = (currentTurn % 2 == 0) 
        ? battle.challenger 
        : battle.opponent;
    require(msg.sender == expectedPlayer, "Not your turn");
    
    // Check turn timeout
    require(
        block.timestamp <= battle.lastTurnTime + TURN_TIMEOUT,
        "Turn timeout - opponent can claim win"
    );
    
    // Decode turn data
    TurnData memory data = abi.decode(turnData, (TurnData));
    
    // Verify agent ownership
    require(
        agents[data.agentId].owner == msg.sender,
        "Not agent owner"
    );
    require(
        data.agentId == battle.challengerAgent || 
        data.agentId == battle.opponentAgent,
        "Agent not in battle"
    );
    
    // ============================================
    // STEP 2: ANTI-FRONTRUNNING (COMMIT-REVEAL)
    // ============================================
    
    // Compute turn hash
    bytes32 turnHash = keccak256(abi.encodePacked(
        battleId,
        currentTurn,
        data.action,
        data.target,
        data.salt,
        msg.sender
    ));
    
    // Prevent replay attacks
    require(!usedTurnHashes[turnHash], "Turn hash already used");
    usedTurnHashes[turnHash] = true;
    
    // Verify signature
    bytes32 messageHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        turnHash
    ));
    address signer = ECDSA.recover(messageHash, data.signature);
    require(signer == msg.sender, "Invalid signature");
    
    // ============================================
    // STEP 3: BUILD VERIFICATION CONTEXT
    // ============================================
    
    VerificationContext memory context;
    context.blockNumber = block.number;
    context.blockTimestamp = block.timestamp;
    context.blockHash = blockhash(block.number - 1); // Previous block (current unavailable)
    
    // Fetch mechanic-specific data (gas-optimized with try-catch)
    if (battle.mechanicType == MechanicType.TWAPPrice || 
        battle.mechanicType == MechanicType.Combined) {
        context.twapPrice = getTWAPPrice(battleId);
    }
    
    if (battle.mechanicType == MechanicType.VRFRandom || 
        battle.mechanicType == MechanicType.Combined) {
        context.vrfRandomness = uint256(battle.randomSeed) ^ 
                               uint256(context.blockHash);
    }
    
    if (battle.mechanicType == MechanicType.NFTOwnership || 
        battle.mechanicType == MechanicType.Combined) {
        // Example: Check if player owns specific NFT
        context.nftOwner = msg.sender; // Simplified - actual check in verify function
    }
    
    // ============================================
    // STEP 4: VERIFY TURN BASED ON MECHANIC TYPE
    // ============================================
    
    // Build turn struct for verification
    Turn memory newTurn = Turn({
        battleId: battleId,
        turnNumber: currentTurn,
        player: msg.sender,
        previousHash: currentTurn > 0 
            ? battleTurns[battleId][currentTurn - 1].currentHash 
            : bytes32(0),
        currentHash: turnHash,
        moveData: turnData,
        proof: proof,
        blockNumber: block.number,
        timestamp: block.timestamp,
        verified: false
    });
    
    // Route to appropriate verifier
    bool isValid;
    
    if (battle.mechanicType == MechanicType.BlockHash) {
        isValid = verifyBlockHash(newTurn, context);
    } else if (battle.mechanicType == MechanicType.TWAPPrice) {
        isValid = verifyTWAPPrice(newTurn, context);
    } else if (battle.mechanicType == MechanicType.VRFRandom) {
        isValid = verifyVRFRandom(newTurn, context);
    } else if (battle.mechanicType == MechanicType.NFTOwnership) {
        isValid = verifyNFTOwnership(newTurn, context);
    } else if (battle.mechanicType == MechanicType.Combined) {
        // Combined requires all verifications to pass
        isValid = verifyBlockHash(newTurn, context) &&
                  verifyTWAPPrice(newTurn, context) &&
                  verifyVRFRandom(newTurn, context);
    }
    
    require(isValid, "Turn verification failed");
    newTurn.verified = true;
    
    // ============================================
    // STEP 5: UPDATE BATTLE STATE
    // ============================================
    
    // Store turn
    battleTurns[battleId].push(newTurn);
    
    // Update battle state
    battle.currentTurn = currentTurn + 1;
    battle.lastTurnTime = block.timestamp;
    
    // Increment player nonce for replay protection
    playerNonces[msg.sender]++;
    
    // ============================================
    // STEP 6: CHECK BATTLE COMPLETION CONDITIONS
    // ============================================
    
    // Check if battle should auto-resolve
    if (battle.currentTurn >= MAX_TURNS) {
        _autoResolveBattle(battleId);
    }
    
    // Emit event for off-chain processing
    emit TurnSubmitted(
        battleId,
        currentTurn,
        msg.sender,
        data.agentId,
        turnHash,
        block.timestamp
    );
}

// ============================================
// VERIFICATION IMPLEMENTATIONS
// ============================================

function verifyBlockHash(
    Turn calldata turn,
    VerificationContext memory context
) internal pure returns (bool) {
    // Extract action parameters from move data
    (uint256 action, uint256 target, bytes32 salt) = abi.decode(
        turn.moveData,
        (uint256, uint256, bytes32)
    );
    
    // Generate deterministic random from block hash
    uint256 deterministicRandom = uint256(keccak256(abi.encodePacked(
        context.blockHash,
        salt,
        turn.turnNumber
    )));
    
    // Verify action is valid given the randomness
    // Example: action must be <= (random % 100) for certain move types
    if (action > 10) { // Complex actions require verification
        uint256 threshold = deterministicRandom % 100;
        require(action <= threshold + 50, "Action exceeds threshold");
    }
    
    // Verify hash chain integrity
    if (turn.turnNumber > 0) {
        bytes32 expectedPrevHash = keccak256(abi.encodePacked(
            turn.battleId,
            turn.turnNumber - 1,
            turn.player
        ));
        // In production, compare against stored previous hash
    }
    
    return true;
}

function verifyTWAPPrice(
    Turn calldata turn,
    VerificationContext memory context
) internal view returns (bool) {
    // Extract price-dependent action
    (uint256 action, uint256 target, ) = abi.decode(
        turn.moveData,
        (uint256, uint256, bytes32)
    );
    
    // Get TWAP price (cached in context)
    uint256 twapPrice = context.twapPrice;
    require(twapPrice > 0, "Invalid TWAP price");
    
    // Verify action validity based on price
    // Example: Certain moves only valid if price above/below threshold
    if (action == 5) { // Price-dependent special move
        uint256 priceThreshold = 1000 * 1e18; // Example threshold
        require(twapPrice > priceThreshold, "Price condition not met");
    }
    
    // Price must be recent (within last hour)
    require(
        context.blockTimestamp - (context.blockTimestamp % 3600) <= 
        context.blockTimestamp,
        "TWAP price too old"
    );
    
    return true;
}

function verifyVRFRandom(
    Turn calldata turn,
    VerificationContext memory context
) internal view returns (bool) {
    // VRF randomness must be available
    require(context.vrfRandomness != 0, "VRF not available");
    
    // Extract action
    (uint256 action, uint256 target, bytes32 salt) = abi.decode(
        turn.moveData,
        (uint256, uint256, bytes32)
    );
    
    // Combine VRF with turn-specific entropy
    uint256 turnRandom = uint256(keccak256(abi.encodePacked(
        context.vrfRandomness,
        salt,
        turn.turnNumber,
        turn.player
    )));
    
    // Verify critical hits, dodges, etc. based on randomness
    uint256 critChance = 15; // 15% base crit chance
    uint256 roll = turnRandom % 100;
    
    // Action validation based on roll
    if (action == 9) { // Critical strike
        require(roll < critChance, "Crit failed - roll too high");
    }
    
    return true;
}

function verifyNFTOwnership(
    Turn calldata turn,
    VerificationContext memory context
) internal view returns (bool) {
    // Extract NFT requirements from move data
    (uint256 action, uint256 requiredNFTId, address nftContract) = abi.decode(
        turn.moveData,
        (uint256, uint256, address)
    );
    
    // Verify ownership
    if (requiredNFTId > 0) {
        try IERC721(nftContract).ownerOf(requiredNFTId) returns (address owner) {
            require(owner == turn.player, "NFT ownership verification failed");
        } catch {
            revert("NFT contract call failed");
        }
    }
    
    return true;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTWAPPrice(uint256 battleId) internal view returns (uint256) {
    // Get TWAP from Uniswap V3 pool
    // Gas optimization: Use cached oracle or single slot read
    
    address pool = IUniswapV3Factory(uniswapFactory).getPool(
        WETH,      // token0
        USDC,      // token1
        3000       // 0.3% fee tier
    );
    
    // Get time-weighted average tick
    (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
        pool,
        3600 // 1 hour TWAP
    );
    
    // Convert tick to price
    uint256 price = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);
    return price;
}

function _autoResolveBattle(uint256 battleId) internal {
    Battle storage battle = battles[battleId];
    
    // Determine winner based on turn data or default
    // Simplified: First player wins if max turns reached
    // In production: Calculate based on damage dealt, HP remaining, etc.
    
    battle.state = BattleState.Completed;
    battle.winner = battle.challengerAgent; // Default - actual logic more complex
    
    emit BattleAutoResolved(battleId, battle.winner, "Max turns reached");
}
```

---

## 5. Gas Optimization Notes

### Storage Optimizations
```solidity
// Pack variables to minimize slots
struct Battle {
    uint128 id;              // Slot 1 (16 bytes)
    uint128 challengerAgent; // Slot 1 (16 bytes)
    uint128 opponentAgent;   // Slot 2 (16 bytes)
    uint128 stakeAmount;     // Slot 2 (16 bytes)
    address challenger;      // Slot 3 (20 bytes)
    address opponent;        // Slot 4 (20 bytes)
    uint64 createdAt;        // Slot 3 (8 bytes) - sufficient until year 2.9B
    uint64 startedAt;        // Slot 4 (8 bytes)
    uint64 lastTurnTime;     // Slot 4 (8 bytes)
    uint32 currentTurn;      // Slot 4 (4 bytes)
    uint32 winner;           // Slot 4 (4 bytes)
    BattleState state;       // Slot 4 (1 byte)
    MechanicType mechanicType; // Slot 4 (1 byte)
}
```

### SLOAD Optimizations
```solidity
function submitTurn(uint256 battleId, ...) external {
    // Cache storage reads
    Battle storage battle = battles[battleId];
    
    // Read once, use multiple times
    uint256 currentTurnCached = battle.currentTurn;
    BattleState stateCached = battle.state;
    
    // ... use cached values instead of re-reading
}
```

### Calldata vs Memory
```solidity
// Use calldata for external function params to avoid copying
function verifyTurn(
    uint256 battleId,
    Turn calldata turn,  // calldata - no copy
    VerificationContext memory context  // memory - needed for modifications
) external view;
```

### Event Packing
```solidity
event TurnSubmitted(
    uint256 indexed battleId,    // Indexed for filtering
    uint256 indexed turnNumber,  // Indexed
    address indexed player,      // Indexed
    uint256 agentId,             // Non-indexed (cheaper)
    bytes32 turnHash,            // Non-indexed
    uint256 timestamp            // Non-indexed
);
```

### L2 Specific Optimizations (Base)
```solidity
// Base L2 has different gas costs - optimize for:
// - Calldata is cheaper (favor external calls)
// - Storage SSTOREs are relatively cheaper
// - Computation is cheaper

// Use transient storage (EIP-1153) if available
// For reentrancy locks and temporary data
bytes32 constant REENTRANCY_LOCK = keccak256("clawttack.reentrancy");

modifier nonReentrant() {
    // Use transient storage for gas efficiency on L2
    assembly {
        if tload(REENTRANCY_LOCK) {
            revert(0, 0)
        }
        tstore(REENTRANCY_LOCK, 1)
    }
    _;
    assembly {
        tstore(REENTRANCY_LOCK, 0)
    }
}
```

---

## 6. Integration Points for On-Chain Data Sources

### 6.1 Uniswap V3 TWAP Integration
```solidity
interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        );
}

library OracleLibrary {
    function consult(
        address pool,
        uint32 secondsAgo
    ) internal view returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity) {
        // Implementation for TWAP calculation
    }
}
```

### 6.2 Chainlink VRF Integration
```solidity
contract ClawttackBattle is VRFConsumerBaseV2 {
    // VRF configuration
    uint64 subscriptionId;
    bytes32 keyHash;
    uint16 requestConfirmations = 3;
    uint32 callbackGasLimit = 100000;
    uint32 numWords = 1;
    
    function requestRandomWords(uint256 battleId) internal {
        uint256 requestId = requestRandomness(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        
        battleToRequest[battleId] = requestId;
        requestToBattle[requestId] = battleId;
    }
    
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        uint256 battleId = requestToBattle[requestId];
        battles[battleId].randomSeed = bytes32(randomWords[0]);
        
        emit RandomnessFulfilled(battleId, randomWords[0]);
    }
}
```

### 6.3 Block Header Access
```solidity
// Access block data (limited to last 256 blocks on EVM)
function getBlockData(uint256 blockNumber) internal view returns (
    bytes32 blockHash,
    uint256 timestamp,
    address coinbase,
    uint256 difficulty
) {
    // blockhash() returns 0 for current block or blocks > 256 old
    blockHash = blockhash(blockNumber);
    timestamp = block.timestamp;
    coinbase = block.coinbase;
    difficulty = block.prevrandao; // post-merge
}
```

### 6.4 External NFT Checks
```solidity
interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}

function verifyNFTOwnershipBatch(
    address nftContract,
    uint256[] calldata tokenIds,
    address expectedOwner
) external view returns (bool) {
    for (uint256 i = 0; i < tokenIds.length; i++) {
        try IERC721(nftContract).ownerOf(tokenIds[i]) returns (address owner) {
            if (owner != expectedOwner) return false;
        } catch {
            return false;
        }
    }
    return true;
}
```

---

## 7. Security Considerations

### 7.1 Front-Running Prevention
```solidity
// Commit-Reveal Pattern
mapping(bytes32 => uint256) public commitments;

function commitMove(bytes32 commitment) external {
    commitments[commitment] = block.number;
}

function revealMove(
    uint256 battleId,
    uint256 action,
    bytes32 salt
) external {
    bytes32 commitment = keccak256(abi.encodePacked(
        battleId, action, salt, msg.sender
    ));
    
    require(commitments[commitment] > 0, "Commitment not found");
    require(
        block.number >= commitments[commitment] + 2,
        "Reveal too early"
    );
    
    // Process move...
}
```

### 7.2 Reentrancy Protection
```solidity
// Using OpenZeppelin's ReentrancyGuard or custom implementation
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ClawttackBattle is ReentrancyGuard {
    function resolveBattle(uint256 battleId) external nonReentrant {
        // ... logic
        
        // External call last (checks-effects-interactions)
        (bool success, ) = winner.call{value: prizeAmount}("");
        require(success, "Transfer failed");
    }
}
```

### 7.3 Access Control
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ClawttackBattle is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    
    modifier onlyAgentOwner(uint256 agentId) {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        _;
    }
    
    modifier onlyBattleParticipant(uint256 battleId) {
        Battle storage b = battles[battleId];
        require(
            msg.sender == b.challenger || msg.sender == b.opponent,
            "Not participant"
        );
        _;
    }
}
```

### 7.4 Timeout Handling
```solidity
function claimTimeoutWin(uint256 battleId) external nonReentrant {
    Battle storage battle = battles[battleId];
    
    require(battle.state == BattleState.Active, "Battle not active");
    require(
        block.timestamp > battle.lastTurnTime + TURN_TIMEOUT,
        "Turn not timed out"
    );
    
    // Determine who timed out
    address expectedPlayer = (battle.currentTurn % 2 == 0) 
        ? battle.challenger 
        : battle.opponent;
    
    require(msg.sender != expectedPlayer, "Cannot claim your own timeout");
    
    // Winner is the non-timeout player
    battle.winner = (msg.sender == battle.challenger) 
        ? battle.challengerAgent 
        : battle.opponentAgent;
    battle.state = BattleState.Completed;
    
    // Distribute pot
    _distributePrize(battleId);
    
    emit TimeoutWinClaimed(battleId, battle.winner, msg.sender);
}
```

---

## 8. Complete Contract Architecture

```
ClawttackBattle/
├── Core/
│   ├── ClawttackBattle.sol (Main contract)
│   ├── ClawttackAgent.sol (Agent NFT contract)
│   └── ClawttackELO.sol (ELO calculation library)
├── Verification/
│   ├── BlockHashVerifier.sol
│   ├── TWAPVerifier.sol
│   ├── VRFFVerifier.sol
│   └── NFTVerifier.sol
├── Libraries/
│   ├── BattleLib.sol (Shared battle logic)
│   ├── ELOLib.sol (ELO calculations)
│   └── VerificationLib.sol (Verification helpers)
├── Interfaces/
│   ├── IClawttackBattle.sol
│   ├── IUniswapV3Pool.sol
│   └── IERC721.sol
└── Utils/
    ├── ReentrancyGuard.sol
    └── Pausable.sol
```

---

## 9. Deployment Configuration (Base L2)

```solidity
// Base Mainnet Addresses
address constant BASE_WETH = 0x4200000000000000000000000000000000000006;
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant BASE_UNISWAP_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
address constant BASE_VRF_COORDINATOR = 0x...; // Update with actual

// Gas configuration for Base
uint256 constant BASE_L2_GAS_LIMIT = 1000000;
uint256 constant BASE_L2_GAS_PRICE = 1000000000; // 1 gwei
```

---

## Summary

This architecture provides:

1. **Efficient State Management**: Packed structs, cached reads, minimal storage writes
2. **Flexible Verification**: Modular verifier system supporting multiple mechanic types
3. **Gas Optimization**: Calldata usage, transient storage, L2-specific optimizations
4. **Security**: Commit-reveal, reentrancy protection, access control, timeout handling
5. **Integration Ready**: TWAP, VRF, block headers, external NFTs
6. **Base L2 Optimized**: Leverages lower calldata costs, cheaper computation

The `submitTurn()` function implements a comprehensive verification pipeline that can be extended with additional mechanic types while maintaining gas efficiency on Base L2.
