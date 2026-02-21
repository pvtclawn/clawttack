// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SpyVsSpy.sol";
import "../src/ClawttackRegistry.sol";

contract SpyVsSpyTest is Test {
    SpyVsSpy public scenario;
    ClawttackRegistry public registry;

    address agentA = address(0xA);
    address agentB = address(0xB);
    address owner = address(0x1);

    string secretA = "crimson lighthouse";
    string secretB = "velvet thunder";
    bytes32 hashA;
    bytes32 hashB;

    function setUp() public {
        vm.startPrank(owner);
        scenario = new SpyVsSpy();
        registry = new ClawttackRegistry(owner);
        vm.stopPrank();

        hashA = keccak256(abi.encodePacked(secretA));
        hashB = keccak256(abi.encodePacked(secretB));
    }

    function test_metadata() public view {
        assertEq(scenario.name(), "Spy vs Spy");
        assertEq(scenario.playerCount(), 2);
        assertEq(scenario.maxTurns(), 20);
    }

    function test_setup_and_settle_agentA_wins() public {
        bytes32 battleId = keccak256("battle1");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory setupData = abi.encode(hashA, hashB, agentA, agentB);
        bytes32 commitment = scenario.setup(battleId, agents, setupData);

        // Commitment should be hash of both secret hashes
        assertEq(commitment, keccak256(abi.encodePacked(hashA, hashB)));

        // Agent A extracted B's secret first
        bytes memory reveal = abi.encode(secretA, secretB, agentA);
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, agentA);
    }

    function test_setup_and_settle_agentB_wins() public {
        bytes32 battleId = keccak256("battle2");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory setupData = abi.encode(hashA, hashB, agentA, agentB);
        scenario.setup(battleId, agents, setupData);

        bytes memory reveal = abi.encode(secretA, secretB, agentB);
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, agentB);
    }

    function test_settle_draw() public {
        bytes32 battleId = keccak256("battle3");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory setupData = abi.encode(hashA, hashB, agentA, agentB);
        scenario.setup(battleId, agents, setupData);

        // Neither extracted = draw
        bytes memory reveal = abi.encode(secretA, secretB, address(0));
        address winner = scenario.settle(battleId, bytes32(0), reveal);
        assertEq(winner, address(0));
    }

    function test_revert_wrong_secret() public {
        bytes32 battleId = keccak256("battle4");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory setupData = abi.encode(hashA, hashB, agentA, agentB);
        scenario.setup(battleId, agents, setupData);

        // Wrong secret A
        bytes memory reveal = abi.encode("wrong secret", secretB, agentA);
        vm.expectRevert("Secret A does not match");
        scenario.settle(battleId, bytes32(0), reveal);
    }

    function test_revert_double_settle() public {
        bytes32 battleId = keccak256("battle5");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory setupData = abi.encode(hashA, hashB, agentA, agentB);
        scenario.setup(battleId, agents, setupData);

        bytes memory reveal = abi.encode(secretA, secretB, agentA);
        scenario.settle(battleId, bytes32(0), reveal);

        vm.expectRevert("Already settled");
        scenario.settle(battleId, bytes32(0), reveal);
    }

    function test_revert_invalid_winner() public {
        bytes32 battleId = keccak256("battle6");
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        bytes memory setupData = abi.encode(hashA, hashB, agentA, agentB);
        scenario.setup(battleId, agents, setupData);

        // Winner is not a participant
        bytes memory reveal = abi.encode(secretA, secretB, address(0xDEAD));
        vm.expectRevert("Winner must be a participant");
        scenario.settle(battleId, bytes32(0), reveal);
    }
}
