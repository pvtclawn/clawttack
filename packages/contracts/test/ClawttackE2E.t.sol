// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {ClawttackArena} from "../src/ClawttackArena.sol";
import {ClawttackBattle} from "../src/ClawttackBattle.sol";
import {ClawttackTypes} from "../src/libraries/ClawttackTypes.sol";
import {ClawttackErrors} from "../src/libraries/ClawttackErrors.sol";
import {VOPRegistry} from "../src/VOPRegistry.sol";
import {BIP39Words} from "../src/BIP39Words.sol";
import {IVerifiableOraclePrimitive} from "../src/interfaces/IVerifiableOraclePrimitive.sol";

contract MockVOP is IVerifiableOraclePrimitive {
    function verify(bytes calldata, uint256 solution, uint256) external pure returns (bool) {
        return solution == 42;
    }
}

contract ClawttackE2ETest is Test {
    ClawttackArena arena;
    ClawttackBattle implementation;
    VOPRegistry registry;
    BIP39Words dict;
    MockVOP mockVop;

    address alice = address(0x111);
    uint256 agentAlice;

    address bob = address(0x222);
    uint256 agentBob;

    function setUp() public {
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        implementation = new ClawttackBattle();
        arena = new ClawttackArena();
        arena.setBattleImplementation(address(implementation));

        registry = new VOPRegistry();
        mockVop = new MockVOP();
        registry.addVop(address(mockVop));
        arena.setVopRegistry(address(registry));
        
        // Setup Protocol Economics
        arena.setAgentRegistrationFee(0.005 ether);
        arena.setProtocolFeeRate(500);

        // Mock BIP39 Data
        bytes memory packedData = abi.encodePacked(uint8(3), "art", uint8(5), "agent", uint8(6), "ignore");
        bytes memory sstoreData = abi.encodePacked(bytes1(0x00), packedData);
        address dataLoc = address(0x9999);
        vm.etch(dataLoc, sstoreData);
        dict = new BIP39Words(dataLoc, 3);
        arena.setWordDictionary(address(dict));

        vm.prank(alice);
        agentAlice = arena.registerAgent{value: 0.005 ether}();

        vm.prank(bob);
        agentBob = arena.registerAgent{value: 0.005 ether}();
    }

    function _encodeSegments(address battle, string memory text, bytes memory truth) internal view returns (bytes32[32] memory segments) {
        ClawttackBattle b = ClawttackBattle(payable(battle));
        uint256 truthIndex = uint256(keccak256(abi.encodePacked(b.DOMAIN_TYPE_INDEX(), b.sequenceHash(), b.battleId()))) % 32;
        
        bytes32 truthHash = keccak256(truth);
        bytes memory textBytes = bytes(text);
        
        uint256 offset = 0;
        for (uint256 i = 0; i < 32; i++) {
            if (i == truthIndex) {
                segments[i] = truthHash;
            } else {
                bytes32 chunk;
                for (uint256 j = 0; j < 32; j++) {
                    if (offset + j < textBytes.length) {
                        chunk |= bytes32(textBytes[offset + j]) >> (j * 8);
                    }
                }
                segments[i] = chunk;
                offset += 32;
            }
        }
    }

    receive() external payable {}

    function _runBattleSimulation(ClawttackTypes.BattleConfig memory config, uint256 totalTurns) internal {
        vm.prank(alice);
        address battleAddress = arena.createBattle{value: config.stake}(agentAlice, config);
        ClawttackBattle battle = ClawttackBattle(payable(battleAddress));

        vm.prank(bob);
        battle.acceptBattle{value: config.stake}(agentBob);

        vm.roll(block.number + config.warmupBlocks + 1);

        bool aFirst = battle.firstMoverA();

        for (uint256 i = 0; i < totalTurns; i++) {
            address currentPlayer = aFirst ? (i % 2 == 0 ? alice : bob) : (i % 2 == 0 ? bob : alice);
            
            uint16 targetIdx = battle.targetWordIndex();
            uint16 poisonIdx = battle.poisonWordIndex();
            string memory actualTarget = dict.word(targetIdx);
            
            ClawttackTypes.TurnPayload memory payload;

            // If we are caught in an RNG trap where the target word IS the poison word,
            // we MUST use a Joker to bypass linguistic verification entirely.
            if (i > 0 && targetIdx == poisonIdx) {
                string memory narrative = "This is a Joker bypass string that must be physically longer than 256 characters so let us pad it out right now. Pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad pad.";
                payload = ClawttackTypes.TurnPayload({
                    solution: 0,
                    segments: _encodeSegments(address(battle), narrative, ""),
                    nextVopParams: "",
                    poisonWordIndex: uint16((targetIdx + 1) % 3)
                });
            } else {
                string memory narrative = string(
                    abi.encodePacked(
                        "This is a legally minimum string exceeding sixty four characters containing ", actualTarget, " cleanly."
                    )
                );
                payload = ClawttackTypes.TurnPayload({
                    solution: 42,
                    segments: _encodeSegments(address(battle), narrative, ""),
                    nextVopParams: "",
                    poisonWordIndex: uint16((targetIdx + 1) % 3) // Set a distinct poison word
                });
            }
            
            vm.prank(currentPlayer);
            battle.submitTurn(payload);

            // Increment blocks for next turn based on halving decay, we'll just advance by 1 block for simplicity
            vm.roll(block.number + 1);
        }
        
        // After simulating back-and-forth, let's force a timeout so the battle settles
        vm.roll(block.number + 300); // Exceed max base timeout
        
        address winner = aFirst ? (totalTurns % 2 == 0 ? alice : bob) : (totalTurns % 2 == 0 ? bob : alice);
        address loser = aFirst ? (totalTurns % 2 == 0 ? bob : alice) : (totalTurns % 2 == 0 ? alice : bob);

        vm.prank(winner);
        battle.claimTimeoutWin();
        
        assertEq(uint8(battle.state()), uint8(ClawttackTypes.BattleState.Settled));
    }

    // --- GAME MODES ---

    function test_E2E_Blitz() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.01 ether,
            baseTimeoutBlocks: 15, // Absolute min
            warmupBlocks: 5,       // Absolute min
            targetAgentId: 0,
            maxTurns: 10,          // Absolute min
            maxJokers: 1
        });
        
        // Simulate a rapid 4-turn game that ends in a quick timeout
        _runBattleSimulation(config, 4);
    }

    function test_E2E_Medium() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.05 ether,
            baseTimeoutBlocks: 60,  // Standard 12 minute blocks
            warmupBlocks: 25,       // 5 min warmup
            targetAgentId: 0,
            maxTurns: 20,           // Standard
            maxJokers: 2
        });
        
        // Simulate a standard 12-turn game
        _runBattleSimulation(config, 12);
    }

    function test_E2E_Marathon() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.5 ether,
            baseTimeoutBlocks: 300, // Max 1-hour rounds
            warmupBlocks: 150,      // Max 30 min warmup
            targetAgentId: 0,
            maxTurns: 40,           // Max 
            maxJokers: 3            // Max
        });
        
        // Simulate a gruelling 38-turn game
        _runBattleSimulation(config, 38);
    }

    function test_E2E_BestCase_Blitz() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.01 ether,
            baseTimeoutBlocks: 15,
            warmupBlocks: 5,
            targetAgentId: 0,
            maxTurns: 10,
            maxJokers: 1
        });
        
        vm.prank(alice);
        address battleAddress = arena.createBattle{value: config.stake}(agentAlice, config);
        ClawttackBattle battle = ClawttackBattle(payable(battleAddress));

        vm.prank(bob);
        battle.acceptBattle{value: config.stake}(agentBob);

        vm.roll(block.number + config.warmupBlocks + 1);

        bool aFirst = battle.firstMoverA();
        
        uint256 totalTurns = 4;
        for (uint256 i = 0; i < totalTurns; i++) {
            address currentPlayer = aFirst ? (i % 2 == 0 ? alice : bob) : (i % 2 == 0 ? bob : alice);
            
            uint16 targetIdx = battle.targetWordIndex();
            string memory actualTarget = dict.word(targetIdx);
            
            // Best case: Minimum 64 length. Target word at the very beginning so the parser exits early.
            // Poison word doesn't match the first char of the string.
            string memory narrative = string(
                abi.encodePacked(
                    " ", actualTarget, " aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                )
            );
            
            ClawttackTypes.TurnPayload memory payload = ClawttackTypes.TurnPayload({
                solution: 42,
                segments: _encodeSegments(address(battle), narrative, ""),
                nextVopParams: "",
                poisonWordIndex: uint16((targetIdx + 1) % 3)
            });
            
            vm.prank(currentPlayer);
            battle.submitTurn(payload);
            vm.roll(block.number + 1);
        }
        
        vm.roll(block.number + 300);
        
        address winner = aFirst ? (totalTurns % 2 == 0 ? alice : bob) : (totalTurns % 2 == 0 ? bob : alice);
        address loser = aFirst ? (totalTurns % 2 == 0 ? bob : alice) : (totalTurns % 2 == 0 ? alice : bob);

        vm.prank(winner);
        battle.claimTimeoutWin();
    }

    function test_E2E_WorstCase_Marathon() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0.5 ether,
            baseTimeoutBlocks: 300,
            warmupBlocks: 150,
            targetAgentId: 0,
            maxTurns: 40,
            maxJokers: 3
        });
        
        vm.prank(alice);
        address battleAddress = arena.createBattle{value: config.stake}(agentAlice, config);
        ClawttackBattle battle = ClawttackBattle(payable(battleAddress));

        vm.prank(bob);
        battle.acceptBattle{value: config.stake}(agentBob);

        vm.roll(block.number + config.warmupBlocks + 1);

        bool aFirst = battle.firstMoverA();
        
        uint256 totalTurns = 6;
        for (uint256 i = 0; i < totalTurns; i++) {
            address currentPlayer = aFirst ? (i % 2 == 0 ? alice : bob) : (i % 2 == 0 ? bob : alice);
            
            uint16 targetIdx = battle.targetWordIndex();
            uint16 poisonIdx = battle.poisonWordIndex();
            
            string memory actualTarget = dict.word(targetIdx);
            string memory actualPoison = dict.word(poisonIdx);
            
            bytes1 targetFirst = bytes1(0);
            if (bytes(actualTarget).length > 0) targetFirst = bytes(actualTarget)[0];
            
            bytes1 poisonFirst = bytes1(0);
            if (bytes(actualPoison).length > 0) poisonFirst = bytes(actualPoison)[0];
            
            // Worst case string: 992 bytes (31 segments), filled with alternating characters matching the 
            // first char of the poison word and target word. Target word is placed at the very end.
            bytes memory worstCaseNarrative = new bytes(992);
            
            for (uint256 j = 0; j < 992; j++) {
                // Alternate between targetFirst and poisonFirst to maximize inner-loop triggers
                if (j % 2 == 0 && targetFirst != bytes1(0)) {
                    worstCaseNarrative[j] = targetFirst;
                } else if (poisonFirst != bytes1(0)) {
                    worstCaseNarrative[j] = poisonFirst;
                } else {
                    worstCaseNarrative[j] = bytes1("a");
                }
            }
            
            // Place target word securely at the very end to pass the check but force entire string execution
            bytes memory tBytes = bytes(actualTarget);
            // Example: If target is "art" (length 3), we want it at index 988, 989, 990. 
            // 987 must be " ". 
            worstCaseNarrative[992 - tBytes.length - 1] = bytes1(" ");
            for (uint256 j = 0; j < tBytes.length; j++) {
                worstCaseNarrative[992 - tBytes.length + j] = tBytes[j];
            }
            
            // Overwrite first characters to make it legally lowercase letters that match poison start
            // Just ensuring string has spaces before target word.
            
            ClawttackTypes.TurnPayload memory payload = ClawttackTypes.TurnPayload({
                solution: 42,
                segments: _encodeSegments(address(battle), string(worstCaseNarrative), ""),
                nextVopParams: "",
                poisonWordIndex: uint16((targetIdx + 1) % 3)
            });
            
            vm.prank(currentPlayer);
            battle.submitTurn(payload);
            vm.roll(block.number + 1);
        }
        
        vm.roll(block.number + 300);
        
        address winner = aFirst ? (totalTurns % 2 == 0 ? alice : bob) : (totalTurns % 2 == 0 ? bob : alice);
        address loser = aFirst ? (totalTurns % 2 == 0 ? bob : alice) : (totalTurns % 2 == 0 ? alice : bob);

        vm.prank(winner);
        battle.claimTimeoutWin();
    }
}
