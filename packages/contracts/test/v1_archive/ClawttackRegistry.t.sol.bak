// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClawttackRegistry.sol";
import "../src/InjectionCTF.sol";

contract ClawttackRegistryTest is Test {
    ClawttackRegistry public registry;
    InjectionCTF public ctf;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        registry = new ClawttackRegistry(feeRecipient);
        ctf = new InjectionCTF();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // --- Agent Registration ---

    function test_registerAgent() public {
        vm.prank(alice);
        registry.registerAgent();
        
        ClawttackRegistry.AgentStats memory stats = registry.getAgent(alice);
        assertEq(stats.elo, 1200);
        assertEq(stats.wins, 0);
        assertEq(stats.losses, 0);
    }

    function test_registerAgent_idempotent() public {
        vm.prank(alice);
        registry.registerAgent();
        
        vm.prank(alice);
        registry.registerAgent();
        
        ClawttackRegistry.AgentStats memory stats = registry.getAgent(alice);
        assertEq(stats.elo, 1200); // Unchanged
    }

    // --- Battle Creation ---

    function test_createBattle() public {
        bytes32 battleId = keccak256("battle-001");
        string memory secret = "dragon crystal harbor sunset";
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        
        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        vm.prank(alice);
        registry.createBattle{value: 0.01 ether}(
            battleId,
            address(ctf),
            agents,
            setupData
        );
        
        ClawttackRegistry.Battle memory battle = registry.getBattle(battleId);
        assertEq(battle.scenario, address(ctf));
        assertEq(uint8(battle.state), uint8(ClawttackRegistry.BattleState.Active));
        assertEq(battle.entryFee, 0.01 ether);
        assertEq(battle.commitment, secretHash);
    }

    function test_createBattle_autoRegistersAgents() public {
        bytes32 battleId = keccak256("battle-002");
        bytes32 secretHash = keccak256(abi.encodePacked("secret"));
        
        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        vm.prank(alice);
        registry.createBattle(battleId, address(ctf), agents, setupData);
        
        // Both agents should be registered with default Elo
        assertEq(registry.getAgent(alice).elo, 1200);
        assertEq(registry.getAgent(bob).elo, 1200);
    }

    // --- Settlement ---

    function test_settle_defenderWins() public {
        bytes32 battleId = keccak256("battle-settle-1");
        string memory secret = "dragon crystal harbor sunset";
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        
        address[] memory agents = new address[](2);
        agents[0] = alice; // attacker
        agents[1] = bob;   // defender
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        // Create battle with entry fee
        vm.prank(alice);
        registry.createBattle{value: 1 ether}(
            battleId,
            address(ctf),
            agents,
            setupData
        );
        
        uint256 bobBalanceBefore = bob.balance;
        uint256 feeBalanceBefore = feeRecipient.balance;
        
        // Settle: defender wins (attacker didn't find secret)
        bytes32 fakeCid = keccak256("ipfs-cid");
        bytes memory reveal = abi.encode(secret, false); // attackerFoundIt = false
        
        registry.settle(battleId, fakeCid, reveal);
        
        // Check battle state
        ClawttackRegistry.Battle memory battle = registry.getBattle(battleId);
        assertEq(uint8(battle.state), uint8(ClawttackRegistry.BattleState.Settled));
        assertEq(battle.winner, bob);
        assertEq(battle.turnLogCid, fakeCid);
        
        // Check payout: 1 ETH - 5% fee = 0.95 ETH to winner
        assertEq(bob.balance - bobBalanceBefore, 0.95 ether);
        assertEq(feeRecipient.balance - feeBalanceBefore, 0.05 ether);
    }

    function test_settle_attackerWins() public {
        bytes32 battleId = keccak256("battle-settle-2");
        string memory secret = "moonlight sonata";
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        
        address[] memory agents = new address[](2);
        agents[0] = alice; // attacker
        agents[1] = bob;   // defender
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        vm.prank(alice);
        registry.createBattle{value: 0.5 ether}(
            battleId,
            address(ctf),
            agents,
            setupData
        );
        
        uint256 aliceBalanceBefore = alice.balance;
        
        // Settle: attacker wins
        bytes memory reveal = abi.encode(secret, true);
        registry.settle(battleId, keccak256("cid"), reveal);
        
        ClawttackRegistry.Battle memory battle = registry.getBattle(battleId);
        assertEq(battle.winner, alice);
        
        // Alice gets 0.5 ETH - 5% = 0.475 ETH
        assertEq(alice.balance - aliceBalanceBefore, 0.475 ether);
    }

    function test_settle_wrongSecret_reverts() public {
        bytes32 battleId = keccak256("battle-settle-3");
        string memory secret = "real secret";
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        
        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        vm.prank(alice);
        registry.createBattle(battleId, address(ctf), agents, setupData);
        
        // Try settling with wrong secret
        bytes memory badReveal = abi.encode("wrong secret", true);
        vm.expectRevert("Secret does not match commitment");
        registry.settle(battleId, keccak256("cid"), badReveal);
    }

    function test_settle_doubleSettle_reverts() public {
        bytes32 battleId = keccak256("battle-settle-4");
        string memory secret = "test";
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        
        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        vm.prank(alice);
        registry.createBattle(battleId, address(ctf), agents, setupData);
        
        bytes memory reveal = abi.encode(secret, false);
        registry.settle(battleId, keccak256("cid"), reveal);
        
        // Try settling again
        vm.expectRevert();
        registry.settle(battleId, keccak256("cid"), reveal);
    }

    // --- Elo ---

    function test_elo_winnerGains_loserLoses() public {
        bytes32 battleId = keccak256("elo-test-1");
        string memory secret = "s";
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        
        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;
        
        bytes memory setupData = abi.encode(secretHash, bob, alice);
        
        vm.prank(alice);
        registry.createBattle(battleId, address(ctf), agents, setupData);
        
        // Both start at 1200
        assertEq(registry.getAgent(alice).elo, 1200);
        assertEq(registry.getAgent(bob).elo, 1200);
        
        // Bob (defender) wins
        bytes memory reveal = abi.encode(secret, false);
        registry.settle(battleId, keccak256("cid"), reveal);
        
        // Equal Elo → expected 0.5, winner gets K*(1-0.5) = 16 points
        assertGt(registry.getAgent(bob).elo, 1200);
        assertLt(registry.getAgent(alice).elo, 1200);
        
        // Win/loss counters
        assertEq(registry.getAgent(bob).wins, 1);
        assertEq(registry.getAgent(alice).losses, 1);
    }

    // --- Admin ---

    function test_setProtocolFeeRate() public {
        registry.setProtocolFeeRate(300); // 3%
        assertEq(registry.protocolFeeRate(), 300);
    }

    function test_setProtocolFeeRate_maxCap() public {
        vm.expectRevert("Max 10%");
        registry.setProtocolFeeRate(1100);
    }

    function test_setProtocolFeeRate_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setProtocolFeeRate(300);
    }
}
