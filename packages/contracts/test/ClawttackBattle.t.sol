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

contract ClawttackBattleTest is Test {
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

        // Mock BIP39 Data (words: 0:"art", 1:"agent", 2:"ignore")
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

    function test_CreateAndAcceptBattle() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 1 ether,
            baseTimeoutBlocks: 30,
            warmupBlocks: 10,
            targetAgentId: 0,
            maxTurns: 20,
            maxJokers: 3
        });

        vm.prank(alice);
        address battleAddress = arena.createBattle{value: 1 ether}(agentAlice, config);
        ClawttackBattle battle = ClawttackBattle(payable(battleAddress));

        assertEq(battle.challengerId(), agentAlice);
        assertEq(battle.totalPot(), 1 ether);
        assertEq(uint8(battle.state()), uint8(ClawttackTypes.BattleState.Open));

        vm.prank(bob);
        battle.acceptBattle{value: 1 ether}(agentBob);

        assertEq(battle.acceptorId(), agentBob);
        assertEq(battle.totalPot(), 2 ether);
        assertEq(uint8(battle.state()), uint8(ClawttackTypes.BattleState.Active));
    }

    function test_TurnLinguistics() public {
        ClawttackTypes.BattleConfig memory config = ClawttackTypes.BattleConfig({
            stake: 0, baseTimeoutBlocks: 30, warmupBlocks: 5, targetAgentId: 0, maxTurns: 20, maxJokers: 3
        });

        vm.prank(alice);
        address battleAddress = arena.createBattle(agentAlice, config);
        ClawttackBattle battle = ClawttackBattle(payable(battleAddress));

        // Predict Randomness for Target Word
        // Set prevrandao so target is "art" (0)

        vm.prank(bob);
        battle.acceptBattle(agentBob);

        // Assume TargetWordIndex is fetched here, let's read it
        uint16 targetIdx = battle.targetWordIndex();
        // Just use whatever is randomly picked
        string memory actualTarget = dict.word(targetIdx);

        vm.roll(block.number + 6);

        bool aFirst = battle.firstMoverA();
        address firstPlayer = aFirst ? alice : bob;

        // Narrative that matches. Needs to be > 64 chars
        string memory narrative = string(
            abi.encodePacked(
                "This is a long narrative exceeding 64 chars containing ", actualTarget, " exactly bounded."
            )
        );

        ClawttackTypes.TurnPayload memory payload = ClawttackTypes.TurnPayload({
            solution: 42,
            segments: _encodeSegments(address(battle), narrative, ""),
            nextVopParams: "",
            poisonWordIndex: 2 // "ignore"
        });

        vm.prank(firstPlayer);
        battle.submitTurn(payload);

        assertEq(battle.currentTurn(), 1);

        // Opponent turn (should fail if poison word uttered)
        address secondPlayer = aFirst ? bob : alice;
        string memory badNarrative = string(
            abi.encodePacked("Another very long narrative exceeding 64 chars this time uttering ignore safely inside.")
        );

        ClawttackTypes.TurnPayload memory payload2 = ClawttackTypes.TurnPayload({
            solution: 42,
            segments: _encodeSegments(address(battle), badNarrative, ""),
            nextVopParams: "",
            poisonWordIndex: 1
        });

        vm.prank(secondPlayer);
        vm.expectRevert(ClawttackErrors.PoisonWordDetected.selector);
        battle.submitTurn(payload2);
    }
}
