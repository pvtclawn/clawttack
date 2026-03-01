// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {ClawttackArena} from "../src/ClawttackArena.sol";
import {ClawttackBattleV4} from "../src/ClawttackBattleV4.sol";
import {ClawttackTypesV4} from "../src/libraries/ClawttackTypesV4.sol";
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
 * @title ArenaV4E2E
 * @notice Full lifecycle test: deploy arena → register agents → create v4 battle → accept → play turns
 */
contract ArenaV4E2E is Test {
    ClawttackArena arena;
    ClawttackBattleV4 battleImpl;
    TestWordDict wordDict;
    HashPreimageVOP hashVop;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // Deploy infrastructure
        wordDict = new TestWordDict();
        hashVop = new HashPreimageVOP();
        battleImpl = new ClawttackBattleV4();

        arena = new ClawttackArena(address(wordDict));
        arena.setBattleImplementationV4(address(battleImpl));
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

        // 2. Create v4 battle
        ClawttackTypesV4.BattleConfigV4 memory config = ClawttackTypesV4.BattleConfigV4({
            stake: 0.01 ether,
            warmupBlocks: 15,
            targetAgentId: 0, // open challenge
            maxJokers: 2
        });
        bytes32 aliceSecret = keccak256("alice-secret");

        vm.prank(alice);
        address battleAddr = arena.createBattleV4{value: 0.01 ether}(aliceId, config, aliceSecret);
        assertTrue(battleAddr != address(0), "Battle should be deployed");

        // 3. Verify battle state
        ClawttackBattleV4 battle = ClawttackBattleV4(payable(battleAddr));
        (ClawttackBattleV4.BattlePhase phase,,,,, uint256 battleId) = battle.getBattleState();
        assertEq(uint8(phase), 0, "Should be Open");
        assertEq(battleId, 1, "First battle");

        // 4. Accept battle
        bytes32 bobSecret = keccak256("bob-secret");
        vm.prank(bob);
        battle.acceptBattle{value: 0.01 ether}(bobId, bobSecret);

        (ClawttackBattleV4.BattlePhase phaseAfter,,,,,) = battle.getBattleState();
        assertEq(uint8(phaseAfter), 1, "Should be Active");

        // 5. Verify pot
        assertEq(address(battle).balance, 0.02 ether, "Pot should be 2x stake");
    }

    function test_createBattleV4_requiresV4Impl() public {
        // Deploy arena without v4 impl
        ClawttackArena arena2 = new ClawttackArena(address(wordDict));
        // Don't set v4 impl

        vm.prank(alice);
        arena2.registerAgent();

        ClawttackTypesV4.BattleConfigV4 memory config = ClawttackTypesV4.BattleConfigV4({
            stake: 0, warmupBlocks: 15, targetAgentId: 0, maxJokers: 2
        });

        vm.prank(alice);
        vm.expectRevert(); // InvalidCall — no v4 impl set
        arena2.createBattleV4(1, config, bytes32(0));
    }

    function test_createBattleV4_invalidConfig() public {
        vm.prank(alice);
        arena.registerAgent();

        // warmupBlocks too low
        ClawttackTypesV4.BattleConfigV4 memory config = ClawttackTypesV4.BattleConfigV4({
            stake: 0, warmupBlocks: 1, targetAgentId: 0, maxJokers: 2
        });

        vm.prank(alice);
        vm.expectRevert(); // ConfigOutOfBounds
        arena.createBattleV4(1, config, bytes32(0));
    }

    function test_cancelBattle_refundsStake() public {
        vm.prank(alice);
        uint256 aliceId = arena.registerAgent();

        ClawttackTypesV4.BattleConfigV4 memory config = ClawttackTypesV4.BattleConfigV4({
            stake: 0.05 ether, warmupBlocks: 15, targetAgentId: 0, maxJokers: 2
        });

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        address battleAddr = arena.createBattleV4{value: 0.05 ether}(aliceId, config, bytes32(0));

        // Cancel
        vm.prank(alice);
        ClawttackBattleV4(payable(battleAddr)).cancelBattle();

        // Alice gets refund
        assertEq(alice.balance, balBefore, "Alice should get full refund");
    }
}
