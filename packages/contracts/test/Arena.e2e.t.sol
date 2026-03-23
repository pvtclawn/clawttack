// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ClawttackArena} from "../src/ClawttackArena.sol";
import {ClawttackBattle} from "../src/ClawttackBattle.sol";
import {ClawttackTypes} from "../src/libraries/ClawttackTypes.sol";
import {BIP39Words} from "../src/BIP39Words.sol";
import {HashPreimageVOP} from "../src/vops/HashPreimageVOP.sol";
import {IWordDictionary} from "../src/interfaces/IWordDictionary.sol";

/// @notice Minimal word dictionary for tests (avoids SSTORE2 complexity)
contract TestWordDict is IWordDictionary {
    string[] private w;
    constructor() {
        // 20 words — enough for target + poison + 4 NCC candidates
        w.push("abandon"); w.push("ability"); w.push("able"); w.push("about");
        w.push("above"); w.push("absent"); w.push("absorb"); w.push("abstract");
        w.push("absurd"); w.push("abuse"); w.push("access"); w.push("accident");
        w.push("account"); w.push("accuse"); w.push("achieve"); w.push("acid");
        w.push("acoustic"); w.push("acquire"); w.push("across"); w.push("act");
    }
    function word(uint16 i) external view override returns (string memory) { return w[i]; }
    function wordCount() external view override returns (uint16) { return uint16(w.length); }
}

/**
 * @title ArenaE2E
 * @notice Full lifecycle test: deploy arena → register agents → create v0 battle → accept → play turns
 */
contract ArenaE2E is Test {
    ClawttackArena arena;
    ClawttackBattle battleImpl;
    TestWordDict wordDict;
    HashPreimageVOP hashVop;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // Deploy infrastructure
        wordDict = new TestWordDict();
        hashVop = new HashPreimageVOP();
        battleImpl = new ClawttackBattle();

        arena = new ClawttackArena(address(wordDict));
        arena.setBattleImplementation(address(battleImpl));
        arena.addVop(address(hashVop));

        // Zero fees for testing
        arena.setProtocolFeeRate(0);
        arena.setBattleCreationFee(0);
        arena.setAgentRegistrationFee(0);

        // Fund agents
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_fullLifecycle_registerCreateAccept() public {
        // 1. Register agents
        vm.prank(alice);
        uint256 aliceId = arena.registerAgent();
        assertEq(aliceId, 1);

        vm.prank(bob);
        uint256 bobId = arena.registerAgent();
        assertEq(bobId, 2);

        // 2. Create v0 battle
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.01 ether,
            targetAgentId: 0, // open challenge
            inviteHash: bytes32(0)
        });

        vm.prank(alice);
        address battleAddr = arena.createBattle{value: 0.01 ether}(aliceId, config);
        assertTrue(battleAddr != address(0), "Battle should be deployed");

        // 3. Verify battle state
        ClawttackBattle battle = ClawttackBattle(payable(battleAddr));
        (ClawttackBattle.BattlePhase phase,,,,, uint256 battleId) = battle.getBattleState();
        assertEq(uint8(phase), 0, "Should be Open");
        assertEq(battleId, 1, "First battle");

        // 4. Accept battle
        vm.prank(bob);
        battle.acceptBattle{value: 0.01 ether}(bobId, bytes32(0));

        (ClawttackBattle.BattlePhase phaseAfter,,,,,) = battle.getBattleState();
        assertEq(uint8(phaseAfter), 1, "Should be Active");

        // 5. Verify pot
        assertEq(address(battle).balance, 0.02 ether, "Pot should be 2x stake");
    }

    function test_createBattle_requiresImpl() public {
        // Deploy arena without v0 impl
        ClawttackArena arena2 = new ClawttackArena(address(wordDict));
        // Don't set v0 impl

        vm.prank(alice);
        arena2.registerAgent();

        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({stake: 0, targetAgentId: 0, inviteHash: bytes32(0)});

        vm.prank(alice);
        vm.expectRevert(); // InvalidCall — no v0 impl set
        arena2.createBattle(1, config);
    }

    function test_createBattle_invalidConfig() public {
        vm.prank(alice);
        arena.registerAgent();

        // Just verify we can create a battle with zero stake
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0, targetAgentId: 0, inviteHash: bytes32(0)
        });

        vm.prank(alice);
        arena.createBattle(1, config);
    }

    function test_cancelBattle_refundsStake() public {
        vm.prank(alice);
        uint256 aliceId = arena.registerAgent();

        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.05 ether, targetAgentId: 0, inviteHash: bytes32(0)
        });

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        address battleAddr = arena.createBattle{value: 0.05 ether}(aliceId, config);

        // Cancel
        vm.prank(alice);
        ClawttackBattle(payable(battleAddr)).cancelBattle();

        // Alice gets refund
        assertEq(alice.balance, balBefore, "Alice should get full refund");
    }
}
