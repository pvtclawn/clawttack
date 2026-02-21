// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ChallengeWordBattle.sol";

contract ChallengeWordBattleTest is Test {
    ChallengeWordBattle public scenario;

    address agentA = address(0xA);
    address agentB = address(0xB);

    string seedA = "alpha-strategy-42";
    string seedB = "beta-counter-77";
    bytes32 commitA;
    bytes32 commitB;

    function setUp() public {
        scenario = new ChallengeWordBattle();
        commitA = keccak256(abi.encodePacked(seedA));
        commitB = keccak256(abi.encodePacked(seedB));
    }

    // --- Metadata ---

    function test_metadata() public view {
        assertEq(scenario.name(), "Challenge Word Battle");
        assertEq(scenario.playerCount(), 2);
        assertEq(scenario.maxTurns(), 10);
    }

    // --- Setup ---

    function test_setup() public {
        bytes32 battleId = keccak256("cwb-1");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        bytes32 commitment = scenario.setup(battleId, agents, data);

        assertEq(commitment, keccak256(abi.encodePacked(commitA, commitB)));
    }

    function test_setup_reversed_agents() public {
        bytes32 battleId = keccak256("cwb-2");
        address[] memory agents = new address[](2);
        agents[0] = agentB; // reversed
        agents[1] = agentA;

        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        bytes32 commitment = scenario.setup(battleId, agents, data);

        assertEq(commitment, keccak256(abi.encodePacked(commitA, commitB)));
    }

    function test_revert_wrong_agents() public {
        bytes32 battleId = keccak256("cwb-3");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = address(0xDEAD);

        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        vm.expectRevert("Agents must match roles");
        scenario.setup(battleId, agents, data);
    }

    function test_revert_wrong_player_count() public {
        bytes32 battleId = keccak256("cwb-4");
        address[] memory agents = new address[](1);
        agents[0] = agentA;

        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        vm.expectRevert("Requires exactly 2 agents");
        scenario.setup(battleId, agents, data);
    }

    // --- Challenge Words ---

    function test_challenge_word_deterministic() public {
        bytes32 battleId = keccak256("cwb-5");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        scenario.setup(battleId, agents, data);

        // Same inputs → same word
        string memory word1 = scenario.getChallengeWord(battleId, 1);
        string memory word2 = scenario.getChallengeWord(battleId, 1);
        assertEq(word1, word2);

        // Different turns → (likely) different words
        string memory word3 = scenario.getChallengeWord(battleId, 2);
        // Words are from a 64-item list, so they could theoretically collide
        // but we verify they're non-empty
        assertTrue(bytes(word1).length > 0);
        assertTrue(bytes(word3).length > 0);
    }

    function test_challenge_words_all_turns() public {
        bytes32 battleId = keccak256("cwb-6");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        scenario.setup(battleId, agents, data);

        // All 10 turns should produce valid words
        for (uint16 i = 1; i <= 10; i++) {
            string memory word = scenario.getChallengeWord(battleId, i);
            assertTrue(bytes(word).length == 4, "All words should be 4 chars");
        }
    }

    function test_revert_challenge_word_no_setup() public {
        vm.expectRevert("Battle not set up");
        scenario.getChallengeWord(keccak256("nonexistent"), 1);
    }

    // --- Decreasing Timer ---

    function test_decreasing_timer() public view {
        assertEq(scenario.getTurnTimeout(1), 60);   // turn 1: 60s
        assertEq(scenario.getTurnTimeout(2), 30);   // turn 2: 30s
        assertEq(scenario.getTurnTimeout(3), 15);   // turn 3: 15s
        assertEq(scenario.getTurnTimeout(4), 7);    // turn 4: 7s
        assertEq(scenario.getTurnTimeout(5), 3);    // turn 5: 3s
    }

    function test_timer_minimum() public view {
        // Turns beyond 5 should hit minimum 1s
        assertEq(scenario.getTurnTimeout(6), 1);
        assertEq(scenario.getTurnTimeout(7), 1);
        assertEq(scenario.getTurnTimeout(10), 1);
        assertEq(scenario.getTurnTimeout(20), 1);
    }

    // --- Settlement ---

    function test_settle_draw_nobody_failed() public {
        bytes32 battleId = keccak256("cwb-7");
        _setupBattle(battleId);

        // Neither failed (failTurn = 0)
        bytes memory reveal = abi.encode(seedA, seedB, uint16(0), uint16(0));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, address(0)); // draw
    }

    function test_settle_agentA_failed() public {
        bytes32 battleId = keccak256("cwb-8");
        _setupBattle(battleId);

        // A failed on turn 3, B never failed
        bytes memory reveal = abi.encode(seedA, seedB, uint16(3), uint16(0));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, agentB); // B wins
    }

    function test_settle_agentB_failed() public {
        bytes32 battleId = keccak256("cwb-9");
        _setupBattle(battleId);

        // B failed on turn 5, A never failed
        bytes memory reveal = abi.encode(seedA, seedB, uint16(0), uint16(5));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, agentA); // A wins
    }

    function test_settle_both_failed_A_first() public {
        bytes32 battleId = keccak256("cwb-10");
        _setupBattle(battleId);

        // A failed turn 2, B failed turn 5 → A failed first → B wins
        bytes memory reveal = abi.encode(seedA, seedB, uint16(2), uint16(5));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, agentB);
    }

    function test_settle_both_failed_B_first() public {
        bytes32 battleId = keccak256("cwb-11");
        _setupBattle(battleId);

        // A failed turn 7, B failed turn 3 → B failed first → A wins
        bytes memory reveal = abi.encode(seedA, seedB, uint16(7), uint16(3));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, agentA);
    }

    function test_settle_both_failed_same_turn() public {
        bytes32 battleId = keccak256("cwb-12");
        _setupBattle(battleId);

        // Both failed on turn 4 → draw
        bytes memory reveal = abi.encode(seedA, seedB, uint16(4), uint16(4));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, address(0));
    }

    function test_revert_wrong_seed() public {
        bytes32 battleId = keccak256("cwb-13");
        _setupBattle(battleId);

        bytes memory reveal = abi.encode("wrong-seed", seedB, uint16(0), uint16(0));
        vm.expectRevert("Seed A does not match commitment");
        scenario.settle(battleId, bytes32(0), reveal);
    }

    function test_revert_double_settle() public {
        bytes32 battleId = keccak256("cwb-14");
        _setupBattle(battleId);

        bytes memory reveal = abi.encode(seedA, seedB, uint16(0), uint16(0));
        scenario.settle(battleId, bytes32(0), reveal);

        vm.expectRevert("Already settled");
        scenario.settle(battleId, bytes32(0), reveal);
    }

    function test_revert_settle_no_setup() public {
        vm.expectRevert("Battle not set up");
        bytes memory reveal = abi.encode(seedA, seedB, uint16(0), uint16(0));
        scenario.settle(keccak256("nonexistent"), bytes32(0), reveal);
    }

    // --- Helpers ---

    function _setupBattle(bytes32 battleId) internal {
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;
        bytes memory data = abi.encode(commitA, commitB, agentA, agentB);
        scenario.setup(battleId, agents, data);
    }
}
