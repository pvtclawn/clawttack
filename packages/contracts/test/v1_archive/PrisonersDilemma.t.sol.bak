// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrisonersDilemma.sol";

contract PrisonersDilemmaTest is Test {
    PrisonersDilemma public pd;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public battleId = keccak256("test-battle");

    function setUp() public {
        pd = new PrisonersDilemma();
    }

    function test_name() public view {
        assertEq(pd.name(), "Prisoner's Dilemma");
    }

    function test_playerCount() public view {
        assertEq(pd.playerCount(), 2);
    }

    function test_bothCooperate_draw() public {
        // Both cooperate → 3/3 → draw
        bool choiceA = true;
        bool choiceB = true;
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        bytes32 commitA = keccak256(abi.encodePacked(choiceA, saltA));
        bytes32 commitB = keccak256(abi.encodePacked(choiceB, saltB));

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        pd.setup(battleId, agents, abi.encode(commitA, commitB));

        bytes memory reveal = abi.encode(choiceA, saltA, choiceB, saltB);
        address winner = pd.settle(battleId, bytes32(0), reveal);
        assertEq(winner, address(0)); // Draw
    }

    function test_bothDefect_draw() public {
        // Both defect → 1/1 → draw
        bool choiceA = false;
        bool choiceB = false;
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        bytes32 commitA = keccak256(abi.encodePacked(choiceA, saltA));
        bytes32 commitB = keccak256(abi.encodePacked(choiceB, saltB));

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        pd.setup(battleId, agents, abi.encode(commitA, commitB));

        bytes memory reveal = abi.encode(choiceA, saltA, choiceB, saltB);
        address winner = pd.settle(battleId, bytes32(0), reveal);
        assertEq(winner, address(0)); // Draw
    }

    function test_aDefects_bCooperates_aWins() public {
        // A defects, B cooperates → 5/0 → A wins
        bool choiceA = false;
        bool choiceB = true;
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        bytes32 commitA = keccak256(abi.encodePacked(choiceA, saltA));
        bytes32 commitB = keccak256(abi.encodePacked(choiceB, saltB));

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        pd.setup(battleId, agents, abi.encode(commitA, commitB));

        bytes memory reveal = abi.encode(choiceA, saltA, choiceB, saltB);
        address winner = pd.settle(battleId, bytes32(0), reveal);
        assertEq(winner, alice);
    }

    function test_aCooperates_bDefects_bWins() public {
        // A cooperates, B defects → 0/5 → B wins
        bool choiceA = true;
        bool choiceB = false;
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        bytes32 commitA = keccak256(abi.encodePacked(choiceA, saltA));
        bytes32 commitB = keccak256(abi.encodePacked(choiceB, saltB));

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        pd.setup(battleId, agents, abi.encode(commitA, commitB));

        bytes memory reveal = abi.encode(choiceA, saltA, choiceB, saltB);
        address winner = pd.settle(battleId, bytes32(0), reveal);
        assertEq(winner, bob);
    }

    function test_doubleSettle_reverts() public {
        bool choiceA = true;
        bool choiceB = true;
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        bytes32 commitA = keccak256(abi.encodePacked(choiceA, saltA));
        bytes32 commitB = keccak256(abi.encodePacked(choiceB, saltB));

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        pd.setup(battleId, agents, abi.encode(commitA, commitB));

        bytes memory reveal = abi.encode(choiceA, saltA, choiceB, saltB);
        pd.settle(battleId, bytes32(0), reveal);

        vm.expectRevert("Already settled");
        pd.settle(battleId, bytes32(0), reveal);
    }

    function test_wrongCommitment_reverts() public {
        bool choiceA = true;
        bool choiceB = true;
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        bytes32 commitA = keccak256(abi.encodePacked(choiceA, saltA));
        bytes32 commitB = keccak256(abi.encodePacked(choiceB, saltB));

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        pd.setup(battleId, agents, abi.encode(commitA, commitB));

        // Try to reveal with wrong choice (claim defect when committed cooperate)
        bytes memory badReveal = abi.encode(false, saltA, choiceB, saltB);
        vm.expectRevert("Agent A commitment mismatch");
        pd.settle(battleId, bytes32(0), badReveal);
    }
}
