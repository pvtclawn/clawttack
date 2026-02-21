// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "forge-std/Test.sol";
import "../src/ClawttackArena.sol";
import "../src/BIP39Words.sol";
import "../src/VOPRegistry.sol";
import "../src/vops/HashPreimageVOP.sol";
import "../src/libraries/ClawttackTypes.sol";

contract WordDataDeployer {
    function deploy(bytes memory data) external returns (address addr) {
        bytes memory runtimeData = abi.encodePacked(hex"00", data);
        uint256 dataLen = runtimeData.length;
        bytes memory initCode = abi.encodePacked(
            hex"61", uint16(dataLen), hex"80", hex"60", uint8(12), hex"60", uint8(0), hex"39", hex"60", uint8(0), hex"f3",
            runtimeData
        );
        assembly {
            addr := create(0, add(initCode, 32), mload(initCode))
        }
    }
}

contract ClawttackArenaV3Test is Test {
    using ClawttackTypes for ClawttackTypes.Battle;
    
    ClawttackArena arena;
    VOPRegistry registry;
    HashPreimageVOP hashVOP;

    uint256 challengerPK = 0xA1;
    uint256 opponentPK = 0xB2;
    uint256 attackerPK = 0xC3;
    address challenger = vm.addr(challengerPK);
    address opponent = vm.addr(opponentPK);
    address attacker = vm.addr(attackerPK);
    
    address vaultKey_C = vm.addr(0xCC);
    address vaultKey_O = vm.addr(0xDD);

    function setUp() public {
        WordDataDeployer deployer = new WordDataDeployer();
        bytes memory packed = _packTestWords();
        address dataAddr = deployer.deploy(packed);
        BIP39Words bip39 = new BIP39Words(dataAddr, 64);

        registry = new VOPRegistry();
        hashVOP = new HashPreimageVOP();
        registry.addVOP(address(hashVOP));

        arena = new ClawttackArena(address(registry), address(bip39));

        vm.deal(challenger, 10 ether);
        vm.deal(opponent, 10 ether);
        
        vm.prank(challenger);
        arena.registerAgent(1, vaultKey_C);
        
        vm.prank(opponent);
        arena.registerAgent(2, vaultKey_O);
    }
    
    function test_createAndAcceptBattle() public {
        vm.prank(challenger);
        uint256 battleId = arena.createBattle{value: 0.1 ether}(1);
        
        vm.prank(opponent);
        arena.acceptBattle{value: 0.1 ether}(battleId, 2);
        
        // Let's inspect the returned battle
        ClawttackTypes.Battle memory b = arena.getBattle(battleId);
        
        assertEq(b.agentA, 1);
        assertEq(b.agentB, 2);
        assertEq(b.stakePerAgent, 0.1 ether);
        assertEq(uint8(b.state), uint8(ClawttackTypes.BattleState.Active));
        assertEq(b.currentTurn, 0); // Hasn't advanced past turn 0 yet

        assertTrue(uint256(b.sequenceHash) != 0);
    }

    function test_submitTurn() public {
        vm.prank(challenger);
        uint256 battleId = arena.createBattle{value: 0.1 ether}(1);
        
        vm.prank(opponent);
        arena.acceptBattle{value: 0.1 ether}(battleId, 2);
        
        ClawttackTypes.Battle memory b = arena.getBattle(battleId);
        string memory targetWord = b.expectedTargetWord;
        
        string memory narrative = string(abi.encodePacked("This is a story about the word ", targetWord, " and some other things."));
        bytes memory nextParams = abi.encode(bytes32("next_salt"), uint8(4));
        string[] memory poisonWords = new string[](1);
        poisonWords[0] = "banned";
        
        ClawttackTypes.TurnPayload memory payload = ClawttackTypes.TurnPayload({
            battleId: battleId,
            solution: 0,
            narrative: narrative,
            nextVOPParams: nextParams,
            poisonWords: poisonWords
        });
        
        ClawttackTypes.Battle memory b2 = arena.getBattle(battleId);
        bytes32 currentSequenceHash = b2.sequenceHash;

        bytes32 turnHash = keccak256(abi.encode(
            block.chainid,
            address(arena),
            currentSequenceHash,
            payload.battleId,
            payload.solution,
            keccak256(bytes(payload.narrative)),
            keccak256(payload.nextVOPParams),
            keccak256(abi.encode(payload.poisonWords))
        ));
        
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", turnHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(challengerPK, messageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(challenger);
        arena.submitTurn(battleId, payload, signature);
        
        ClawttackTypes.Battle memory b3 = arena.getBattle(battleId);
        assertEq(b3.currentTurn, 1);
    }

    function test_cancelBattle() public {
        vm.prank(challenger);
        uint256 battleId = arena.createBattle{value: 0.1 ether}(1);
        
        // Opponent cannot cancel
        vm.prank(opponent);
        vm.expectRevert(ClawttackErrors.UnauthorizedTurn.selector);
        arena.cancelBattle(battleId);
        
        // Challenger can cancel
        uint256 balanceBefore = challenger.balance;
        vm.prank(challenger);
        arena.cancelBattle(battleId);
        uint256 balanceAfter = challenger.balance;
        
        assertEq(balanceAfter, balanceBefore + 0.1 ether);
        
        ClawttackTypes.Battle memory b = arena.getBattle(battleId);
        assertEq(uint8(b.state), uint8(ClawttackTypes.BattleState.Cancelled));
        
        // Cannot cancel twice
        vm.prank(challenger);
        vm.expectRevert(ClawttackErrors.BattleNotCancellable.selector);
        arena.cancelBattle(battleId);
    }

    function _packTestWords() internal pure returns (bytes memory) {
        bytes memory result;
        string[64] memory words = [
            "blue", "dark", "fire", "gold", "iron", "jade", "keen", "lime",
            "mint", "navy", "onyx", "pine", "ruby", "sage", "teal", "vine",
            "arch", "bolt", "core", "dawn", "echo", "flux", "glow", "haze",
            "iris", "jolt", "knot", "loom", "mist", "node", "oath", "peak",
            "rift", "silk", "tide", "unit", "vale", "warp", "zero", "apex",
            "band", "cape", "dome", "edge", "fern", "grit", "husk", "isle",
            "jazz", "kite", "lark", "maze", "nest", "opus", "palm", "quay",
            "reed", "spur", "torn", "urge", "veil", "wolf", "yarn", "zest"
        ];
        for (uint i = 0; i < 64; i++) {
            bytes memory w = bytes(words[i]);
            result = abi.encodePacked(result, uint8(w.length), w);
        }
        return result;
    }
}
